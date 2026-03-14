/**
 * LAU Full Sync – verifies the live Banner endpoint, adds comprehensive departments,
 * and populates the DB with live Spring 2026 section data.
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/lau-full-sync.ts
 */

import { PrismaClient } from '@prisma/client'
import { LAUConnector } from '../connectors/universities/lau'
import type { ConnectorSection } from '../connectors/types'

const prisma = new PrismaClient()

// ── LAU Faculty & Department structure ────────────────────────────────────────
// Based on LAU's published academic structure (Beirut + Byblos campuses)

const LAU_FACULTIES: Array<{
  name: string
  slug: string
  departments: Array<{ name: string; code: string; slug: string }>
}> = [
  {
    name: 'Faculty of Arts and Sciences',
    slug: 'lau-fas',
    departments: [
      { name: 'English',                 code: 'ENG',  slug: 'lau-eng'  },
      { name: 'Communication Arts',      code: 'COM',  slug: 'lau-com'  },
      { name: 'Social Sciences',         code: 'SOC',  slug: 'lau-soc'  },
      { name: 'Psychology',              code: 'PSY',  slug: 'lau-psy'  },
      { name: 'Political Science',       code: 'PSC',  slug: 'lau-psc'  },
      { name: 'Philosophy & Humanities', code: 'PHI',  slug: 'lau-phi'  },
      { name: 'History',                 code: 'HIS',  slug: 'lau-his'  },
      { name: 'Arabic',                  code: 'ARA',  slug: 'lau-ara'  },
      { name: 'French',                  code: 'FRE',  slug: 'lau-fre'  },
      { name: 'Mathematics & Statistics',code: 'MTH',  slug: 'lau-mth'  },
      { name: 'Natural Sciences',        code: 'PHY',  slug: 'lau-phy'  },
      { name: 'Biology',                 code: 'BIO',  slug: 'lau-bio'  },
      { name: 'Chemistry',               code: 'CHE',  slug: 'lau-che'  },
      { name: 'Environmental Science',   code: 'ENV',  slug: 'lau-env'  },
    ],
  },
  {
    name: 'Faculty of Engineering',
    slug: 'lau-fe',
    departments: [
      { name: 'Computer Science',                 code: 'CSC',  slug: 'lau-csc'  },
      { name: 'Electrical & Computer Engineering',code: 'EEN',  slug: 'lau-een'  },
      { name: 'Civil Engineering',                code: 'CIE',  slug: 'lau-cie'  },
      { name: 'Industrial & Mechanical Engineering',code: 'IME', slug: 'lau-ime'  },
    ],
  },
  {
    name: 'Faculty of Architecture & Design',
    slug: 'lau-fad',
    departments: [
      { name: 'Architecture',               code: 'ARC',  slug: 'lau-arc'  },
      { name: 'Interior Design',            code: 'IDN',  slug: 'lau-idn'  },
      { name: 'Graphic Design',             code: 'GRD',  slug: 'lau-grd'  },
      { name: 'Fine Arts',                  code: 'ART',  slug: 'lau-art'  },
      { name: 'Visual & Industrial Design', code: 'VIP',  slug: 'lau-vip'  },
    ],
  },
  {
    name: 'Adnan Kassar School of Business',
    slug: 'lau-aksb',
    departments: [
      { name: 'Business Administration', code: 'BUS',  slug: 'lau-bus'  },
      { name: 'Accounting',              code: 'ACC',  slug: 'lau-acc'  },
      { name: 'Finance',                 code: 'FIN',  slug: 'lau-fin'  },
      { name: 'Economics',               code: 'ECO',  slug: 'lau-eco'  },
      { name: 'Management',              code: 'MGT',  slug: 'lau-mgt'  },
      { name: 'Marketing',               code: 'MKT',  slug: 'lau-mkt'  },
    ],
  },
  {
    name: 'Gilbert & Rose-Marie Chagoury School of Medicine',
    slug: 'lau-som',
    departments: [
      { name: 'Medicine',                  code: 'MED',  slug: 'lau-med'  },
      { name: 'Nursing',                   code: 'NUR',  slug: 'lau-nur'  },
      { name: 'Pharmacy',                  code: 'PHA',  slug: 'lau-pha'  },
      { name: 'Public Health',             code: 'PHL',  slug: 'lau-phl'  },
      { name: 'Nutrition & Dietetics',     code: 'NUT',  slug: 'lau-nut'  },
      { name: 'Biomedical Sciences',       code: 'BIF',  slug: 'lau-bif'  },
    ],
  },
  {
    name: 'Faculty of Engineering – Additional Programs',
    slug: 'lau-fea',
    departments: [
      { name: 'Urban & Regional Engineering', code: 'URE',  slug: 'lau-ure'  },
      { name: 'Graduate Engineering',         code: 'GRDE', slug: 'lau-grde' },
      { name: 'General Engineering',          code: 'GNE',  slug: 'lau-gne'  },
    ],
  },
  {
    name: 'School of Education',
    slug: 'lau-soe',
    departments: [
      { name: 'Education',     code: 'EDU',  slug: 'lau-edu'  },
    ],
  },
  {
    name: 'Liberal Arts & Interdisciplinary Studies',
    slug: 'lau-lais',
    departments: [
      { name: 'Liberal Arts & Sciences',  code: 'LAS',  slug: 'lau-las'  },
      { name: 'Hospitality Management',   code: 'HOM',  slug: 'lau-hom'  },
    ],
  },
  {
    name: 'School of Law',
    slug: 'lau-law',
    departments: [
      { name: 'Law', code: 'LAW', slug: 'lau-law-dept' },
    ],
  },
]

// Subject prefix → department code mapping for LAU
const SUBJECT_TO_DEPT: Record<string, string> = {
  // Arts & Sciences
  ENG: 'ENG', ENGL: 'ENG',
  COM: 'COM', JRN: 'COM', ADV: 'COM',
  SOC: 'SOC', ANT: 'SOC',
  PSY: 'PSY',
  PSC: 'PSC', POL: 'PSC',
  PHI: 'PHI', REL: 'PHI', HUM: 'PHI',
  HIS: 'HIS',
  ARA: 'ARA', ARB: 'ARA',
  FRE: 'FRE', FRN: 'FRE',
  MTH: 'MTH', STA: 'MTH', MATH: 'MTH',
  PHY: 'PHY', PHYS: 'PHY',
  BIO: 'BIO', BIOL: 'BIO',
  CHE: 'CHE', CHEM: 'CHE',
  ENV: 'ENV', ENVS: 'ENV',
  // Engineering
  CSC: 'CSC', CIS: 'CSC', CNE: 'CSC',
  EEN: 'EEN', EE: 'EEN', ECE: 'EEN', NET: 'EEN',
  CIE: 'CIE', CVE: 'CIE', CIVE: 'CIE',
  IME: 'IME', MEC: 'IME', MECH: 'IME', IND: 'IME',
  // Architecture & Design
  ARC: 'ARC', ARCH: 'ARC',
  IDN: 'IDN', INAR: 'IDN',
  GRD: 'GRD',
  // Business
  BUS: 'BUS', BUSS: 'BUS', MGT: 'MGT', MGMT: 'MGT',
  MKT: 'MKT', MKTG: 'MKT',
  ACC: 'ACC', ACCT: 'ACC',
  FIN: 'FIN', FMSE: 'FIN',
  ECO: 'ECO', ECON: 'ECO',
  ENT: 'BUS',
  // Medicine/Nursing/Health
  MED: 'MED', NUR: 'NUR', NURS: 'NUR',
  PHA: 'PHA', PHAR: 'PHA',
  PHL: 'PHL', PBHL: 'PHL', PH: 'PHL',
  // Law
  LAW: 'LAW',
  // Engineering aliases found in live catalog
  MEE: 'IME',   // Mechanical & Energy Engineering
  COE: 'EEN',   // Computer & Communications Engineering
  ELE: 'EEN',   // Electrical Engineering
  INE: 'IME',   // Industrial Engineering
  GNE: 'GNE',   // General Engineering
  URE: 'URE',   // Urban & Regional Engineering
  GRDE: 'GRDE', // Graduate Engineering
  // Design/Arts aliases
  VIP: 'VIP',   // Visual & Industrial Programming / Design
  ART: 'ART',   // Fine Arts
  GRDA: 'GRD',  // Graphic Design alias
  // Sciences aliases
  CHM: 'CHE',   // Chemistry (alternate prefix at LAU)
  BIF: 'BIF',   // Biomedical/Bioinformatics
  // Health aliases
  NUT: 'NUT',   // Nutrition & Dietetics
  // Interdisciplinary
  LAS: 'LAS',   // Liberal Arts & Sciences
  HOM: 'HOM',   // Hospitality Management
  EDU: 'EDU',   // Education
  // Other subject codes found at LAU
  INT: 'PSC',   // International Affairs
  INA: 'IDN',   // Interior Architecture
  // Remaining live-catalog subjects
  AAI: 'CSC',   // Artificial Intelligence
  DSC: 'CSC',   // Data Science
  CYS: 'EEN',   // Cybersecurity
  BDA: 'CSC',   // Big Data Analytics
  ITM: 'CSC',   // Information Technology Management
  FND: 'LAS',   // Foundation Year
  FAS: 'LAS',   // Faculty of Arts & Sciences general courses
  WRK: 'LAS',   // Workshop/Work-integrated learning
  PFA: 'ART',   // Performing & Fine Arts
  JSC: 'COM',   // Journalism & Social Communication
  TVF: 'COM',   // Television & Film
  PED: 'BIO',   // Physical Education
  PTE: 'EDU',   // Part-time Education
  QBA: 'ECO',   // Quantitative Business Analysis
  OPM: 'MGT',   // Operations Management
  // Final 15 fallback subjects from live catalog
  ENM: 'MGT',   // Engineering Management
  LLM: 'LAW',   // Master of Laws
  HCM: 'PHL',   // Health Care Management
  HST: 'PHL',   // Health Systems Thinking
  DAN: 'ART',   // Dance (Performing Arts)
  FEM: 'SOC',   // Feminist/Gender Studies
  HRM: 'MGT',   // Human Resource Management
  MCE: 'IME',   // Mechanical & Civil Engineering
  BCH: 'CHE',   // Biochemistry
  MSL: 'MED',   // Medical Sciences
  IGS: 'LAS',   // Interdisciplinary Graduate Studies
  IAA: 'IDN',   // Interior Architecture & Arts
  CLT: 'PHI',   // Cultural Studies
  ICM: 'COM',   // International Communication Management
  ITA: 'FRE',   // Italian (foreign language)
  // Tiny programs (≤4 sections) from third sync pass
  MIG: 'SOC',   // Migration Studies
  TRA: 'ENG',   // Translation
  IEP: 'ENG',   // Intensive English Program
  IPE: 'PSC',   // International Political Economy
  SPA: 'FRE',   // Spanish (foreign language)
  AST: 'PHY',   // Astronomy
  GER: 'FRE',   // German (foreign language)
  HLT: 'PHL',   // Health (general)
  RUS: 'FRE',   // Russian (foreign language)
  CAR: 'LAS',   // Career Development
  CST: 'PHI',   // Cultural Studies (alternate prefix)
  IBS: 'BUS',   // International Business
  LEG: 'LAW',   // Legal Studies
}

// ── Department setup ──────────────────────────────────────────────────────────

async function ensureDepartments(lauId: string): Promise<Map<string, string>> {
  const university = await prisma.university.findUnique({
    where: { id: lauId },
    include: { faculties: { include: { departments: true } } },
  })
  if (!university) throw new Error('LAU not found')

  const deptMap = new Map<string, string>()  // code → id

  // Index existing departments
  for (const fac of university.faculties) {
    for (const dept of fac.departments) {
      if (dept.code) deptMap.set(dept.code, dept.id)
    }
  }

  console.log(`  Existing departments: ${deptMap.size}`)

  for (const facSpec of LAU_FACULTIES) {
    let faculty = university.faculties.find(f => f.slug === facSpec.slug)
    if (!faculty) {
      faculty = await prisma.faculty.create({
        data: { name: facSpec.name, slug: facSpec.slug, universityId: lauId },
        include: { departments: true },
      }) as typeof university.faculties[0]
      console.log(`  Created faculty: ${facSpec.name}`)
    }

    for (const deptSpec of facSpec.departments) {
      if (!deptMap.has(deptSpec.code)) {
        const existing = await prisma.department.findFirst({
          where: { facultyId: faculty.id, code: deptSpec.code },
        })
        if (!existing) {
          const dept = await prisma.department.create({
            data: { name: deptSpec.name, code: deptSpec.code, slug: deptSpec.slug, facultyId: faculty.id },
          })
          deptMap.set(dept.code!, dept.id)
          console.log(`    Created dept: ${deptSpec.code} – ${deptSpec.name}`)
        } else {
          deptMap.set(deptSpec.code, existing.id)
        }
      }
    }
  }

  console.log(`  Total departments: ${deptMap.size}`)
  return deptMap
}

// ── Term ──────────────────────────────────────────────────────────────────────

async function getOrCreateTerm(lauId: string) {
  const existing = await prisma.academicTerm.findFirst({
    where: { season: 'SPRING', year: 2026, universityId: lauId },
  })
  if (existing) {
    // Ensure isCurrent is set
    await prisma.academicTerm.update({ where: { id: existing.id }, data: { isCurrent: true } })
    return existing
  }
  return prisma.academicTerm.create({
    data: { name: 'SPRING 2026', season: 'SPRING', year: 2026, universityId: lauId, isCurrent: true, isActive: true },
  })
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertProfessor(name: string, deptId: string): Promise<string> {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return ''
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  const existing = await prisma.professor.findFirst({
    where: { firstName, lastName, departmentId: deptId },
  })
  if (existing) {
    await prisma.professor.update({ where: { id: existing.id }, data: { lastSyncedAt: new Date() } })
    return existing.id
  }

  const base = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${lastName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  let slug = base; let n = 0
  while (await prisma.professor.findUnique({ where: { slug } })) { n++; slug = `${base}-${n}` }

  const prof = await prisma.professor.create({
    data: { firstName, lastName, fullName: `${firstName} ${lastName}`, slug, departmentId: deptId, lastSyncedAt: new Date() },
  })
  return prof.id
}

async function upsertCourse(code: string, name: string, deptId: string): Promise<string> {
  // Look up by code first (any dept) — prevents duplicates when SUBJECT_TO_DEPT mapping evolves
  const existing = await prisma.course.findFirst({ where: { code } })
  if (existing) {
    await prisma.course.update({ where: { id: existing.id }, data: { name, departmentId: deptId, isActive: true } })
    return existing.id
  }

  const baseSlug = `${code.replace(/\s+/g, '-').toLowerCase()}-lau`
  let slug = baseSlug; let n = 0
  while (true) {
    if (!await prisma.course.findFirst({ where: { slug } })) break
    n++; slug = `${baseSlug}-${n}`
  }

  const course = await prisma.course.create({ data: { code, name, slug, departmentId: deptId, isActive: true } })
  return course.id
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const TERM_CODE = 'SPRING-2026'

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  LAU Full Sync – Live Banner 8 Ingestion')
  console.log(`  Term: ${TERM_CODE}`)
  console.log('══════════════════════════════════════════════════════\n')

  const lau = await prisma.university.findUnique({ where: { slug: 'lau' } })
  if (!lau) throw new Error('LAU not found in DB')

  // Step 1: Ensure departments
  console.log('Step 1: Ensuring all LAU departments exist...')
  const deptMap = await ensureDepartments(lau.id)

  // Step 2: Fetch live sections from Banner 8
  console.log('\nStep 2: Fetching LAU schedule from Banner 8...')
  const connector = new LAUConnector()
  let catalogSections: ConnectorSection[]
  let isLive = true

  try {
    const result = await connector.fetch({ universitySlug: 'lau', termCode: TERM_CODE })
    if (result.isPartial && result.sections.length < 100) {
      // Likely hit the structured fallback — too few sections
      console.error(`  ⚠️  Connector returned ${result.sections.length} sections with isPartial=${result.isPartial}`)
      if (result.errors.length > 0) {
        for (const e of result.errors) console.error(`     ${e}`)
      }
      if (result.sections.length < 20) {
        console.error('  Structured fallback data is too sparse for a real sync — aborting')
        await prisma.$disconnect()
        process.exit(1)
      }
      isLive = false
    }
    catalogSections = result.sections
    console.log(`  ✅ Fetched ${catalogSections.length} sections (live=${!result.isPartial})`)
    if (result.errors.length > 0) {
      for (const e of result.errors) console.log(`  ⚠️  ${e}`)
    }
  } catch (err) {
    console.error(`  ❌ Connector failed: ${err instanceof Error ? err.message : String(err)}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  // Step 3: Academic term
  console.log('\nStep 3: Ensuring academic term exists...')
  const term = await getOrCreateTerm(lau.id)
  console.log(`  Term: ${term.name} (id: ${term.id})`)

  // Step 4: Sync
  console.log('\nStep 4: Syncing sections to database...')

  let added = 0, updated = 0, skipped = 0, errors = 0
  const subjectStats = new Map<string, { courses: Set<string>; sections: number; profs: Set<string> }>()
  const unknownSubjects = new Map<string, number>()
  // Get fallback dept (first available)
  const fallbackDeptId = deptMap.values().next().value ?? null

  for (const sec of catalogSections) {
    try {
      const prefix = sec.courseCode.split(' ')[0]
      const deptCode = SUBJECT_TO_DEPT[prefix] ?? null
      let deptId = deptCode ? deptMap.get(deptCode) ?? null : null

      if (!deptId) {
        unknownSubjects.set(prefix, (unknownSubjects.get(prefix) ?? 0) + 1)
        deptId = fallbackDeptId
        if (!deptId) { skipped++; continue }
      }

      const courseId = await upsertCourse(sec.courseCode, sec.courseName ?? sec.courseCode, deptId)

      const professorIds: string[] = []
      for (const name of sec.instructors) {
        const profId = await upsertProfessor(name, deptId)
        if (profId) professorIds.push(profId)
      }

      const existingSec = await prisma.section.findFirst({
        where: { courseId, termId: term.id, sectionNumber: sec.sectionNumber },
      })

      const qualityFields = {
        crn: sec.sourceIdentifier,
        status: sec.status,
        sourceConnector: sec.sourceConnector,
        sourceIdentifier: sec.sourceIdentifier,
        historicalInference: sec.historicalInference,
        completenessScore: sec.completenessScore,
        dataQualityStatus: sec.dataQualityStatus,
        isStale: false,
        lastSyncedAt: new Date(),
      }

      let sectionId: string

      if (existingSec) {
        await prisma.section.update({ where: { id: existingSec.id }, data: qualityFields })
        await prisma.sectionMeeting.deleteMany({ where: { sectionId: existingSec.id } })
        await prisma.sectionProfessor.deleteMany({ where: { sectionId: existingSec.id } })
        sectionId = existingSec.id
        updated++
      } else {
        const newSec = await prisma.section.create({
          data: { courseId, termId: term.id, sectionNumber: sec.sectionNumber, ...qualityFields },
        })
        sectionId = newSec.id
        added++
      }

      if (sec.meetings.length > 0) {
        await prisma.sectionMeeting.createMany({
          data: sec.meetings.map(m => ({
            sectionId, day: m.day, startTime: m.startTime, endTime: m.endTime,
            type: m.type ?? 'LECTURE', location: m.location ?? null,
          })),
        })
      }

      for (const profId of professorIds) {
        await prisma.sectionProfessor.create({
          data: { sectionId, professorId: profId, isPrimary: true, confidence: 'CONFIRMED' },
        })
        await prisma.professorCourse.upsert({
          where: { professorId_courseId: { professorId: profId, courseId } },
          update: {},
          create: { professorId: profId, courseId },
        })
      }

      if (!subjectStats.has(prefix)) subjectStats.set(prefix, { courses: new Set(), sections: 0, profs: new Set() })
      const s = subjectStats.get(prefix)!
      s.courses.add(sec.courseCode)
      s.sections++
      for (const n of sec.instructors) s.profs.add(n)

    } catch (err) {
      errors++
      if (errors <= 5) console.error(`  Section ${sec.sourceIdentifier} error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Step 5: Coverage report
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  LAU COVERAGE REPORT')
  console.log('══════════════════════════════════════════════════════')
  console.log(`\nData source: ${isLive ? '⚡ LIVE (Banner 8)' : '⚠️  PARTIAL/CACHED'}`)
  console.log(`Sync results: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} errors`)

  const subjects = [...subjectStats.entries()].sort((a, b) => b[1].sections - a[1].sections)
  const totalSubjects   = subjects.length
  const totalCourses    = subjects.reduce((s, [, v]) => s + v.courses.size, 0)
  const totalSections   = subjects.reduce((s, [, v]) => s + v.sections, 0)
  const totalProfs      = new Set(subjects.flatMap(([, v]) => [...v.profs])).size
  const confirmedSecs   = subjects.reduce((s, [, v]) => s + (v.profs.size > 0 ? v.sections : 0), 0)

  console.log(`\n  Total subjects:   ${totalSubjects}`)
  console.log(`  Total courses:    ${totalCourses}`)
  console.log(`  Total sections:   ${totalSections}`)
  console.log(`  Total professors: ${totalProfs}`)
  console.log(`  Confirmed rate:   ${totalSections > 0 ? Math.round((confirmedSecs / totalSections) * 100) : 0}%`)

  if (subjects.length > 0) {
    console.log('\n  Subject breakdown (top 20):')
    console.log('  ' + 'Subject'.padEnd(8) + 'Courses'.padStart(9) + 'Sections'.padStart(10) + 'Profs'.padStart(8) + '  Mapped')
    console.log('  ' + '─'.repeat(55))
    for (const [subj, stats] of subjects.slice(0, 20)) {
      const deptCode = SUBJECT_TO_DEPT[subj] ?? '???'
      const status = deptCode !== '???' ? '✓' : '⚠ fallback'
      console.log(
        '  ' + subj.padEnd(8) + String(stats.courses.size).padStart(9) +
        String(stats.sections).padStart(10) + String(stats.profs.size).padStart(8) +
        `  ${deptCode} ${status}`
      )
    }
  }

  if (unknownSubjects.size > 0) {
    console.log(`\n  ⚠️  Unknown subjects (routed to fallback dept):`)
    for (const [s, n] of [...unknownSubjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`    ${s.padEnd(8)} ${n} sections`)
    }
  } else {
    console.log('\n  ✅ All subjects mapped to departments')
  }

  await prisma.$disconnect()
  console.log('\n  ✅ LAU sync complete\n')
}

main().catch(e => { console.error(e); process.exit(1) })
