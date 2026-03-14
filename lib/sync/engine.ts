/**
 * Sync Engine – runs a connector for a university and persists results to the DB.
 *
 * Flow:
 *   1. Get/create the current academic term
 *   2. Run the connector to fetch ConnectorSection[]
 *   3. For each section: upsert department → course → professor → section
 *   4. Mark sections not seen in this run as stale
 *   5. Update SyncJob record with stats
 */

import { prisma } from '@/lib/db'
import { LogLevel } from '@/lib/constants'
import {
  createSyncContext, startSyncJob, completeSyncJob, failSyncJob,
  upsertCourse, upsertProfessor, upsertSection, SyncResult,
} from './index'
import { getConnector, hasConnector, ConnectorSection } from '@/connectors'
import { checkConnectorHealth } from './healthCheck'
import { checkDBIntegrity, autoCorrectOrphans } from './dbIntegrity'

const STALE_THRESHOLD_MINUTES = 120  // mark sections stale after 2h without update

export interface RunSyncOptions {
  jobId: string
  universityId: string
  universitySlug: string
  termCode?: string
  type?: 'FULL' | 'INCREMENTAL' | 'MANUAL'
}

export async function runSync(options: RunSyncOptions): Promise<SyncResult> {
  const { jobId, universityId, universitySlug, termCode = 'SPRING-2025' } = options
  const ctx = createSyncContext(jobId, universityId)
  const result: SyncResult = { added: 0, updated: 0, skipped: 0, errors: 0 }

  await startSyncJob(jobId)
  await ctx.log(LogLevel.INFO, `Starting sync for ${universitySlug} / ${termCode}`)

  try {
    if (!hasConnector(universitySlug)) {
      throw new Error(`No connector available for university: ${universitySlug}`)
    }

    const connector = getConnector(universitySlug)
    const connectorResult = await connector.fetch({ universitySlug, termCode })

    await ctx.log(LogLevel.INFO, `Connector fetched ${connectorResult.sections.length} sections`, {
      isPartial: connectorResult.isPartial,
      errors: connectorResult.errors,
    })

    if (connectorResult.errors.length > 0) {
      for (const err of connectorResult.errors) {
        await ctx.log(LogLevel.WARN, err)
      }
    }

    // Health check — alert if counts are anomalously low
    const health = checkConnectorHealth(universitySlug, connectorResult)
    await ctx.log(LogLevel.INFO, `Health check: ${health.sectionCount} sections, ${health.subjectCount} subjects, ${health.professorCount} professors`)
    for (const w of health.warnings) await ctx.log(LogLevel.WARN, `[HEALTH] ${w}`)
    for (const c of health.criticals) await ctx.log(LogLevel.ERROR, `[HEALTH CRITICAL] ${c}`)
    if (!health.passed) {
      await ctx.log(LogLevel.ERROR, `Health check FAILED — sync will continue but output may be incomplete`)
    }

    // Get or create academic term
    const term = await getOrCreateTerm(termCode, universityId)

    // Get university faculties/departments for lookup
    const university = await prisma.university.findUnique({
      where: { id: universityId },
      include: {
        faculties: { include: { departments: true } },
      },
    })

    if (!university) throw new Error(`University not found: ${universityId}`)

    // Flatten all departments for lookup
    const allDepts = university.faculties.flatMap(f => f.departments)

    // Process sections
    const syncedSectionIds: string[] = []

    for (const sec of connectorResult.sections) {
      try {
        const sectionId = await processSingleSection(ctx, sec, university.id, allDepts, term.id, result)
        if (sectionId) syncedSectionIds.push(sectionId)
      } catch (err) {
        result.errors++
        await ctx.log(LogLevel.ERROR, `Failed to process section ${sec.sourceIdentifier}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Mark sections not updated in this run as stale (only for full syncs)
    if (options.type === 'FULL' || options.type === 'MANUAL') {
      const staleCount = await markStaleSections(universityId, term.id, syncedSectionIds)
      if (staleCount > 0) {
        await ctx.log(LogLevel.WARN, `Marked ${staleCount} sections as stale`)
      }
    }

    await completeSyncJob(jobId, result)
    await ctx.log(LogLevel.INFO, `Sync complete`, result)

    // Post-sync DB integrity check (Part 2)
    try {
      const orphans = await autoCorrectOrphans(term.id)
      if (orphans.deactivatedOrphans > 0) {
        await ctx.log(LogLevel.WARN, `Auto-corrected ${orphans.deactivatedOrphans} orphaned sections`)
      }
      const integrity = await checkDBIntegrity(universityId, term.id)
      await ctx.log(LogLevel.INFO, `DB integrity score: ${integrity.healthScore}/100`, {
        totalSections: integrity.totalSections,
        noMeetings: integrity.sectionsNoMeetings,
        noProfessors: integrity.sectionsNoProfessors,
        crnCoverage: `${(integrity.crnCoverageRate * 100).toFixed(1)}%`,
        confirmedRate: `${(integrity.confirmedRate * 100).toFixed(1)}%`,
      })
      for (const w of integrity.warnings)  await ctx.log(LogLevel.WARN,  `[INTEGRITY] ${w}`)
      for (const c of integrity.criticals) await ctx.log(LogLevel.ERROR, `[INTEGRITY CRITICAL] ${c}`)
    } catch {
      // Integrity check failure must never crash the sync
    }

    return result

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failSyncJob(jobId, message, true)
    await ctx.log(LogLevel.ERROR, `Sync failed: ${message}`)
    throw err
  }
}

async function processSingleSection(
  ctx: ReturnType<typeof createSyncContext>,
  sec: ConnectorSection,
  universityId: string,
  allDepts: Array<{ id: string; name: string; code: string | null }>,
  termId: string,
  result: SyncResult,
): Promise<string | null> {
  // Find department by course code prefix (e.g. "CMPS 201" → "CMPS" → CS department)
  const dept = findDepartment(sec.courseCode, allDepts, universityId)

  if (!dept) {
    // Auto-create in first available department as a fallback
    result.skipped++
    return null
  }

  // Upsert course
  const { id: courseId } = await upsertCourse(ctx, {
    code: sec.courseCode,
    name: sec.courseName ?? sec.courseCode,
    departmentId: dept.id,
    credits: undefined,
  })

  // Upsert professors
  const professorIds: string[] = []
  for (const instructorName of sec.instructors) {
    const parts = instructorName.trim().split(/\s+/)
    if (parts.length < 2) continue
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')
    const { id: profId } = await upsertProfessor(ctx, {
      firstName,
      lastName,
      departmentId: dept.id,
    })
    professorIds.push(profId)
  }

  // Upsert section
  const { id: sectionId, isNew } = await upsertSection(ctx, {
    courseId,
    termId,
    sectionNumber: sec.sectionNumber,
    crn: sec.sourceIdentifier,
    location: sec.location,
    capacity: sec.capacity,
    enrolled: sec.enrolled,
    seatsRemaining: sec.seatsRemaining,
    status: sec.status,
    sourceConnector: sec.sourceConnector,
    sourceIdentifier: sec.sourceIdentifier,
    historicalInference: sec.historicalInference,
    completenessScore: sec.completenessScore,
    dataQualityStatus: sec.dataQualityStatus,
    professorConfidence: sec.professorConfidence,
    professors: professorIds,
    meetings: sec.meetings,
  })

  if (isNew) result.added++
  else result.updated++

  return sectionId
}

function findDepartment(
  courseCode: string,
  allDepts: Array<{ id: string; name: string; code: string | null }>,
  _universityId: string,
): { id: string; name: string } | null {
  const prefix = courseCode.split(' ')[0].toUpperCase()

  // Exact code match
  const byCode = allDepts.find(d => d.code?.toUpperCase() === prefix)
  if (byCode) return byCode

  // Fuzzy name match
  const CODE_TO_DEPT: Record<string, string[]> = {
    // Computer Science
    CMPS: ['computer', 'computing', 'software'],
    CS: ['computer', 'computing', 'software'],
    CSC: ['computer', 'computing', 'software'],
    CIS: ['computer', 'computing', 'information'],
    IS: ['information', 'computer'],
    // Engineering
    EECE: ['electrical', 'electronic', 'computer'],
    EE: ['electrical', 'electronic'],
    MECH: ['mechanical'],
    MCHE: ['mechanical'],
    CVLE: ['civil', 'environmental'],
    CE: ['civil', 'environmental'],
    INDE: ['industrial'],
    CHME: ['chemical engineering'],
    // Science
    MATH: ['mathematics', 'math'],
    MTH: ['mathematics', 'math'],
    STAT: ['statistics', 'statistic'],
    CHEM: ['chemistry', 'chemical'],
    CHE: ['chemistry', 'chemical'],
    PHYS: ['physics', 'physical'],
    BIOL: ['biology', 'life'],
    BIO: ['biology', 'life'],
    GEOL: ['geology', 'geological'],
    BCHM: ['biochemistry', 'molecular biology'],
    BIOC: ['biochemistry', 'molecular'],
    ANAT: ['anatomy', 'physiology'],
    PATH: ['pathology'],
    // Social Sciences & Humanities (AUB-specific)
    PSPA: ['political studies', 'public administration', 'political science'],
    POLS: ['political studies', 'political science', 'public administration'],
    HIST: ['history', 'archaeology', 'historical'],
    SOAN: ['sociology', 'anthropology', 'media studies', 'social'],
    SOWK: ['sociology', 'social', 'anthropology'],
    ANTH: ['sociology', 'anthropology'],
    PHIL: ['philosophy', 'religion', 'philosophy'],
    RELG: ['religion', 'philosophy'],
    PSYC: ['psychology', 'psychological'],
    ECON: ['economics', 'economic'],
    // Languages
    ARAB: ['arabic', 'near eastern'],
    ARBC: ['arabic', 'near eastern'],
    ENGL: ['english', 'literature'],
    FREN: ['french', 'language'],
    FRN: ['french', 'language'],
    GERM: ['german', 'language'],
    ITAL: ['italian', 'language'],
    GREK: ['greek', 'latin', 'classics'],
    LATN: ['greek', 'latin', 'classics'],
    // Arts
    MUSA: ['music'],
    MUSC: ['music'],
    MUS: ['music'],
    FNAR: ['fine arts', 'art history', 'arts'],
    ART: ['fine arts', 'art'],
    COMM: ['communication', 'media'],
    // Business
    MANG: ['management', 'business'],
    MGMT: ['management', 'business'],
    BUAD: ['business', 'management'],
    BUS: ['business', 'management'],
    BUSS: ['business', 'management', 'administration'],
    BACC: ['accounting', 'finance'],
    ACC: ['accounting', 'finance'],
    ACCT: ['accounting', 'finance'],
    FMSE: ['finance', 'management science'],
    MKT: ['marketing', 'business'],
    MKTG: ['marketing', 'business'],
    // Health & Medicine
    MDED: ['medicine', 'medical'],
    MEDC: ['medicine', 'medical'],
    MED: ['medicine', 'medical'],
    NUR: ['nursing'],
    NURS: ['nursing'],
    PUBH: ['public health', 'health science'],
    HSCI: ['health science', 'public health'],
    PHAR: ['pharmacy', 'pharmacology'],
    PHARM: ['pharmacy', 'pharmacology'],
    PHM: ['pharmacy', 'pharmacology'],
    DEN: ['dentistry', 'dental'],
    // Agriculture
    AGRI: ['agriculture', 'agricultural'],
    ANSC: ['animal', 'veterinary'],
    PLSC: ['plant science', 'agriculture'],
    FTEC: ['food technology', 'food science'],
    NUSC: ['nutrition', 'food'],
    // Architecture & Engineering
    ARCH: ['architecture', 'architectural'],
    ARC: ['architecture', 'architectural'],
    // Law
    LAW: ['law', 'legal', 'civic'],
    INT: ['international', 'political'],
    // Engineering (Engineering courses not otherwise mapped)
    ENG: ['engineering'],
    // Misc
    PHI: ['philosophy'],
    THEO: ['theology', 'philosophy'],
    T: ['technology', 'computing'],
    M: ['mathematics', 'management'],
    B: ['business'],
    A: ['arts', 'humanities'],
    L: ['language', 'english'],
  }

  const keywords = CODE_TO_DEPT[prefix] ?? []
  for (const keyword of keywords) {
    const match = allDepts.find(d => d.name.toLowerCase().includes(keyword))
    if (match) return match
  }

  // Last resort: return first department
  return allDepts[0] ?? null
}

async function getOrCreateTerm(termCode: string, universityId: string) {
  const [season, yearStr] = termCode.split('-')
  const year = parseInt(yearStr)

  const existing = await prisma.academicTerm.findFirst({
    where: { season, year, universityId },
  })
  if (existing) return existing

  return prisma.academicTerm.create({
    data: {
      name: `${season} ${year}`,
      season,
      year,
      universityId,
      isCurrent: true,
      isActive: true,
    },
  })
}

async function markStaleSections(
  universityId: string,
  termId: string,
  recentSectionIds: string[],
): Promise<number> {
  const staleTime = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000)

  const result = await prisma.section.updateMany({
    where: {
      termId,
      course: { department: { faculty: { universityId } } },
      id: { notIn: recentSectionIds },
      lastSyncedAt: { lt: staleTime },
      isStale: false,
    },
    data: { isStale: true },
  })

  return result.count
}
