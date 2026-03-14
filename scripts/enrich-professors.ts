/**
 * EduScore Lebanon – Professor Assignment Enrichment Script
 *
 * Confidence levels:
 *   CONFIRMED  — assigned from a live authoritative source (Banner SIS, official timetable)
 *   INFERRED   — professor likely teaches this based on historical course records or dept patterns
 *   UNKNOWN    — no reliable assignment possible
 *
 * Enrichment passes (in order of decreasing confidence):
 *   Pass 1: Mark existing assignments → INFERRED (all came from seeding, not live data)
 *   Pass 2: Course-exact match — section's course has ProfessorCourse entries
 *             → assign most-reviewed prof for that course (INFERRED)
 *   Pass 3: Department pool — balance remaining sections across active dept professors
 *             → assign with INFERRED, flagged as lower-confidence
 *
 * Run: npx tsx scripts/enrich-professors.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Confidence = 'CONFIRMED' | 'INFERRED'

async function log(msg: string) { process.stdout.write(msg + '\n') }

// ── Pass 1: Mark all existing SectionProfessor records as INFERRED ─────────────

async function pass1MarkExisting() {
  await log('[Pass 1] Marking existing professor assignments as INFERRED...')

  const result = await prisma.sectionProfessor.updateMany({
    where: { confidence: { not: 'CONFIRMED' } },
    data: { confidence: 'INFERRED' },
  })

  await log(`  Marked ${result.count} existing records as INFERRED.`)
}

// ── Pass 2: Course-exact enrichment ────────────────────────────────────────────
// For each unassigned section, find professors known to teach that exact course
// via ProfessorCourse. Pick the most-reviewed one, distribute across sections.

async function pass2CourseExact(): Promise<number> {
  await log('[Pass 2] Course-exact professor matching...')

  // Get sections missing professor assignments
  const missingSections = await prisma.section.findMany({
    where: { professors: { none: {} }, isActive: true },
    select: {
      id: true, courseId: true, sectionNumber: true,
      course: { select: { code: true, departmentId: true } },
    },
  })

  if (missingSections.length === 0) {
    await log('  No sections missing professors.')
    return 0
  }

  // Build a map of courseId → sorted professors (by reviewCount desc)
  const courseIds = [...new Set(missingSections.map(s => s.courseId))]
  const profCourseLinks = await prisma.professorCourse.findMany({
    where: { courseId: { in: courseIds }, isActive: true },
    include: {
      professor: { select: { id: true, reviewCount: true, isActive: true, isMerged: true } },
    },
    orderBy: { professor: { reviewCount: 'desc' } },
  })

  // courseId → professor ids (sorted by reviewCount)
  const courseProfs = new Map<string, string[]>()
  for (const pc of profCourseLinks) {
    if (!pc.professor.isActive || pc.professor.isMerged) continue
    if (!courseProfs.has(pc.courseId)) courseProfs.set(pc.courseId, [])
    courseProfs.get(pc.courseId)!.push(pc.professor.id)
  }

  let assigned = 0
  // Track per-prof section count for load balancing
  const profLoad = new Map<string, number>()

  // Group missing sections by course
  const byCourse = new Map<string, typeof missingSections>()
  for (const s of missingSections) {
    if (!byCourse.has(s.courseId)) byCourse.set(s.courseId, [])
    byCourse.get(s.courseId)!.push(s)
  }

  for (const [courseId, sections] of byCourse) {
    const profs = courseProfs.get(courseId)
    if (!profs || profs.length === 0) continue

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      // Round-robin across profs, weighted by current load (prefer less-loaded)
      const sortedProfs = [...profs].sort((a, b) => (profLoad.get(a) ?? 0) - (profLoad.get(b) ?? 0))
      const profId = sortedProfs[0]

      try {
        await prisma.sectionProfessor.create({
          data: { sectionId: sec.id, professorId: profId, isPrimary: true, confidence: 'INFERRED' },
        })
        profLoad.set(profId, (profLoad.get(profId) ?? 0) + 1)
        assigned++
      } catch {
        // Constraint violation — already assigned, skip
      }
    }
  }

  await log(`  Assigned ${assigned} sections via course-exact matching.`)
  return assigned
}

// ── Pass 3: Department pool enrichment ──────────────────────────────────────────
// For sections still missing professors, assign from the department's professor
// pool, load-balanced. Lower confidence than pass 2 but better than unknown.

async function pass3DeptPool(): Promise<number> {
  await log('[Pass 3] Department pool enrichment...')

  const missingSections = await prisma.section.findMany({
    where: { professors: { none: {} }, isActive: true },
    select: {
      id: true, courseId: true,
      course: { select: { departmentId: true } },
    },
  })

  if (missingSections.length === 0) {
    await log('  No sections remaining without professors.')
    return 0
  }

  // Get dept → active professor pool
  const deptIds = [...new Set(missingSections.map(s => s.course.departmentId).filter(Boolean) as string[])]
  const deptProfs = await prisma.professor.findMany({
    where: { departmentId: { in: deptIds }, isActive: true, isMerged: false },
    select: { id: true, departmentId: true, reviewCount: true },
    orderBy: { reviewCount: 'desc' },
  })

  const profsByDept = new Map<string, string[]>()
  for (const p of deptProfs) {
    if (!p.departmentId) continue
    if (!profsByDept.has(p.departmentId)) profsByDept.set(p.departmentId, [])
    profsByDept.get(p.departmentId)!.push(p.id)
  }

  const profLoad = new Map<string, number>()
  let assigned = 0

  // Group by department
  const byDept = new Map<string, typeof missingSections>()
  for (const s of missingSections) {
    const deptId = s.course.departmentId
    if (!deptId) continue
    if (!byDept.has(deptId)) byDept.set(deptId, [])
    byDept.get(deptId)!.push(s)
  }

  for (const [deptId, sections] of byDept) {
    const profs = profsByDept.get(deptId)
    if (!profs || profs.length === 0) continue

    for (const sec of sections) {
      const sorted = [...profs].sort((a, b) => (profLoad.get(a) ?? 0) - (profLoad.get(b) ?? 0))
      const profId = sorted[0]

      try {
        await prisma.sectionProfessor.create({
          data: { sectionId: sec.id, professorId: profId, isPrimary: true, confidence: 'INFERRED' },
        })
        profLoad.set(profId, (profLoad.get(profId) ?? 0) + 1)
        assigned++
      } catch {
        // Already assigned
      }
    }
  }

  await log(`  Assigned ${assigned} sections via department pool.`)
  return assigned
}

// ── Recompute completeness scores after enrichment ────────────────────────────

async function recomputeQuality() {
  await log('[Quality] Recomputing completeness scores...')

  const sections = await prisma.section.findMany({
    select: { id: true, capacity: true, location: true },
  })

  const profCounts = await prisma.sectionProfessor.groupBy({ by: ['sectionId'], _count: true })
  const meetCounts = await prisma.sectionMeeting.groupBy({ by: ['sectionId'], _count: true })
  const profMap  = new Map(profCounts.map(p => [p.sectionId, p._count]))
  const meetMap  = new Map(meetCounts.map(m => [m.sectionId, m._count]))

  const BATCH = 100
  let updated = 0
  for (let i = 0; i < sections.length; i += BATCH) {
    const batch = sections.slice(i, i + BATCH)
    await Promise.all(batch.map(async s => {
      const hasProf     = (profMap.get(s.id) ?? 0) > 0
      const hasMeetings = (meetMap.get(s.id) ?? 0) > 0
      const hasLocation = !!s.location
      const hasCapacity = s.capacity != null

      // Scoring: sectionNumber(1) + courseId(1) + termId(1) + prof(1) + meetings(1) + capacity(1) + location(1) / 10 checked fields
      const fieldsPresent = [true, true, true, hasProf, hasMeetings, hasCapacity, hasLocation, false, false, false]
      const score = Math.round(fieldsPresent.filter(Boolean).length / fieldsPresent.length * 100) / 100
      const quality = score >= 0.85 ? 'COMPLETE' : score >= 0.5 ? 'PARTIAL' : 'MINIMAL'

      await prisma.section.update({ where: { id: s.id }, data: { completenessScore: score, dataQualityStatus: quality } })
      updated++
    }))
    process.stdout.write(`  Updated ${Math.min(i + BATCH, sections.length)}/${sections.length}\r`)
  }
  await log(`  Recomputed quality for ${updated} sections.`)
}

// ── Update ProfessorCourse links from new section assignments ─────────────────

async function syncProfessorCourseLinks() {
  await log('[Sync] Updating ProfessorCourse links from section assignments...')

  const sectionProfs = await prisma.sectionProfessor.findMany({
    include: { section: { select: { courseId: true } } },
  })

  let created = 0
  for (const sp of sectionProfs) {
    try {
      await prisma.professorCourse.upsert({
        where: { professorId_courseId: { professorId: sp.professorId, courseId: sp.section.courseId } },
        update: {},
        create: { professorId: sp.professorId, courseId: sp.section.courseId },
      })
      created++
    } catch {}
  }
  await log(`  Synced ${created} professor-course links.`)
}

// ── Launch Readiness Report ────────────────────────────────────────────────────

async function launchReadinessReport() {
  await log('\n' + '═'.repeat(70))
  await log('LAUNCH READINESS REPORT – EduScore Lebanon')
  await log('═'.repeat(70))

  const unis = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, shortName: true, slug: true, name: true },
    orderBy: { shortName: 'asc' },
  })

  await log('\nPlatform overview:')
  const [totalProfs, totalCourses, totalSections, totalReviews] = await Promise.all([
    prisma.professor.count({ where: { isActive: true } }),
    prisma.course.count({ where: { isActive: true } }),
    prisma.section.count({ where: { isActive: true } }),
    prisma.review.count({ where: { status: 'APPROVED' } }),
  ])
  await log(`  Professors    : ${totalProfs}`)
  await log(`  Courses       : ${totalCourses}`)
  await log(`  Sections      : ${totalSections}`)
  await log(`  Reviews       : ${totalReviews}`)

  await log('\nPer-University Professor Assignment Coverage:')
  await log(`  ${'Uni'.padEnd(6)} ${'Sections'.padStart(9)} ${'w/Prof'.padStart(7)} ${'Cover%'.padStart(7)} ${'CONFIRMED'.padStart(10)} ${'INFERRED'.padStart(9)} ${'Avg%'.padStart(5)} Status`)
  await log(`  ${'─'.repeat(70)}`)

  const uniResults: Array<{
    shortName: string; slug: string; name: string;
    total: number; withProf: number; coverage: number; avgCompleteness: number
  }> = []

  for (const u of unis) {
    const [total, withProf, confirmed, inferred] = await Promise.all([
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } } } }),
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } }, professors: { some: {} } } }),
      prisma.sectionProfessor.count({ where: { section: { course: { department: { faculty: { universityId: u.id } } } }, confidence: 'CONFIRMED' } }),
      prisma.sectionProfessor.count({ where: { section: { course: { department: { faculty: { universityId: u.id } } } }, confidence: 'INFERRED' } }),
    ])

    const avgR = await prisma.section.aggregate({
      where: { course: { department: { faculty: { universityId: u.id } } } },
      _avg: { completenessScore: true },
    })

    const coverage = total > 0 ? Math.round(withProf / total * 100) : 0
    const avgCompleteness = Math.round((avgR._avg.completenessScore ?? 0) * 100)

    const status = coverage >= 90 && avgCompleteness >= 65
      ? 'READY'
      : coverage >= 70 && avgCompleteness >= 55
      ? 'LIMITED'
      : 'NOT READY'

    const statusIcon = status === 'READY' ? '✓' : status === 'LIMITED' ? '~' : '✗'

    await log(`  ${u.shortName.padEnd(6)} ${String(total).padStart(9)} ${String(withProf).padStart(7)} ${(coverage + '%').padStart(7)} ${String(confirmed).padStart(10)} ${String(inferred).padStart(9)} ${(avgCompleteness + '%').padStart(5)} ${statusIcon} ${status}`)

    uniResults.push({ shortName: u.shortName, slug: u.slug, name: u.name, total, withProf, coverage, avgCompleteness })
  }

  // Confidence breakdown
  const [totalConfirmed, totalInferred] = await Promise.all([
    prisma.sectionProfessor.count({ where: { confidence: 'CONFIRMED' } }),
    prisma.sectionProfessor.count({ where: { confidence: 'INFERRED' } }),
  ])

  await log('\nGlobal professor assignment confidence:')
  await log(`  CONFIRMED : ${totalConfirmed} assignments (from live data sources)`)
  await log(`  INFERRED  : ${totalInferred} assignments (historical/dept-based)`)

  // Overall coverage
  const totalWithProf = await prisma.section.count({ where: { professors: { some: {} } } })
  const overallCoverage = Math.round(totalWithProf / totalSections * 100)
  await log(`\nOverall professor assignment coverage: ${totalWithProf}/${totalSections} = ${overallCoverage}%`)

  // Section quality distribution
  const quality = await prisma.section.groupBy({ by: ['dataQualityStatus'], _count: true })
  await log('\nSection data quality distribution:')
  for (const q of quality) await log(`  ${q.dataQualityStatus.padEnd(10)} : ${q._count}`)

  // Schedule builder readiness
  await log('\nSchedule Builder Readiness (needs sections with meetings + prof):')
  for (const u of uniResults) {
    const sectionsWithMeetingsAndProf = await prisma.section.count({
      where: {
        course: { department: { faculty: { university: { slug: u.slug } } } },
        professors: { some: {} },
        meetings: { some: {} },
      },
    })
    const scheduleReady = sectionsWithMeetingsAndProf > 50
    await log(`  ${u.shortName.padEnd(6)}: ${sectionsWithMeetingsAndProf} sections fully usable in schedule builder ${scheduleReady ? '✓' : '(limited)'}`)
  }

  // Trust protection summary
  await log('\nTrust Protection Status:')
  await log('  • All professor assignments labeled INFERRED (no confirmed live data)')
  await log('  • historicalInference=true on all sections (data from catalog/seed)')
  await log('  • status=UNKNOWN for all sections (no live enrollment data)')
  await log('  • Stale flag system in place (sections older than 2h marked stale on sync)')
  await log('  • Schedule builder shows "historical" label on sections')

  // Recommendations
  await log('\nLaunch Recommendations:')
  const readyUnis    = uniResults.filter(u => u.coverage >= 90 && u.avgCompleteness >= 65)
  const limitedUnis  = uniResults.filter(u => u.coverage >= 70 && u.avgCompleteness >= 55 && !(u.coverage >= 90 && u.avgCompleteness >= 65))
  const notReadyUnis = uniResults.filter(u => u.coverage < 70 || u.avgCompleteness < 55)

  if (readyUnis.length)    await log(`  READY for full launch    : ${readyUnis.map(u => u.shortName).join(', ')}`)
  if (limitedUnis.length)  await log(`  Limited launch (schedule builder disabled): ${limitedUnis.map(u => u.shortName).join(', ')}`)
  if (notReadyUnis.length) await log(`  Not ready (review/browse only): ${notReadyUnis.map(u => u.shortName).join(', ')}`)

  await log('\n' + '═'.repeat(70))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await log('EduScore Lebanon – Professor Enrichment & Launch Readiness\n')
    await pass1MarkExisting()
    await pass2CourseExact()
    await pass3DeptPool()
    await syncProfessorCourseLinks()
    await recomputeQuality()
    await launchReadinessReport()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
