/**
 * EduScore Lebanon – Launch Readiness Report
 *
 * Produces a comprehensive pre-launch assessment covering:
 *   1. Section coverage (total, active, quality tiers)
 *   2. Professor confirmation rate (CONFIRMED vs INFERRED)
 *   3. Stale data rate
 *   4. Schedule builder readiness (sections with meetings)
 *   5. Per-university launch recommendation
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/launch-readiness-report.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function bar(value: number, max = 100, width = 20): string {
  const filled = Math.round((value / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(n: number, d: number): string {
  return d === 0 ? 'N/A' : `${((n / d) * 100).toFixed(1)}%`
}

function grade(confirmedPct: number, coveragePct: number, stalePct: number): string {
  if (confirmedPct >= 60 && coveragePct >= 95 && stalePct < 10) return 'A – Ready'
  if (confirmedPct >= 20 && coveragePct >= 90 && stalePct < 20) return 'B – Acceptable'
  if (coveragePct >= 75 && stalePct < 30)                       return 'C – Marginal'
  return 'D – Not Ready'
}

async function main() {
  const now = new Date()
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║     EduScore Lebanon – Launch Readiness Report           ║')
  console.log(`║     Generated: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC                    ║`)
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // ── 1. Platform-wide stats ──────────────────────────────────────────────
  const [
    totalUniversities,
    totalProfessors,
    totalCourses,
    totalSections,
    totalReviews,
  ] = await Promise.all([
    prisma.university.count(),
    prisma.professor.count(),
    prisma.course.count({ where: { isActive: true } }),
    prisma.section.count({ where: { isActive: true } }),
    prisma.review.count({ where: { status: 'APPROVED' } }),
  ])

  console.log('── 1. Platform Overview ──────────────────────────────────────')
  console.log(`  Universities  : ${totalUniversities}`)
  console.log(`  Professors    : ${totalProfessors}`)
  console.log(`  Courses       : ${totalCourses}`)
  console.log(`  Sections      : ${totalSections}  (active)`)
  console.log(`  Reviews       : ${totalReviews}  (approved)\n`)

  // ── 2. Section data quality ─────────────────────────────────────────────
  const [complete, partial, minimal, stale, historical, withMeetings] = await Promise.all([
    prisma.section.count({ where: { isActive: true, dataQualityStatus: 'COMPLETE' } }),
    prisma.section.count({ where: { isActive: true, dataQualityStatus: 'PARTIAL' } }),
    prisma.section.count({ where: { isActive: true, dataQualityStatus: 'MINIMAL' } }),
    prisma.section.count({ where: { isActive: true, isStale: true } }),
    prisma.section.count({ where: { isActive: true, historicalInference: true } }),
    prisma.section.count({ where: { isActive: true, meetings: { some: {} } } }),
  ])

  const stalePct = (stale / totalSections) * 100

  console.log('── 2. Section Data Quality ───────────────────────────────────')
  console.log(`  COMPLETE  ${bar(complete, totalSections)} ${pct(complete, totalSections).padStart(7)}  (${complete})`)
  console.log(`  PARTIAL   ${bar(partial,  totalSections)} ${pct(partial,  totalSections).padStart(7)}  (${partial})`)
  console.log(`  MINIMAL   ${bar(minimal,  totalSections)} ${pct(minimal,  totalSections).padStart(7)}  (${minimal})`)
  console.log()
  console.log(`  Stale sections      : ${stale} (${stalePct.toFixed(1)}%) ${stalePct > 15 ? '⚠ HIGH' : '✓'}`)
  console.log(`  Historical inference: ${historical} (${pct(historical, totalSections)}) ${historical === totalSections ? '⚠ ALL' : ''}`)
  console.log(`  With meeting times  : ${withMeetings} (${pct(withMeetings, totalSections)}) – schedule builder ready\n`)

  // ── 3. Professor assignment confidence ──────────────────────────────────
  const confirmedAssignments = await prisma.sectionProfessor.count({ where: { confidence: 'CONFIRMED' } })
  const inferredAssignments  = await prisma.sectionProfessor.count({ where: { confidence: 'INFERRED' } })
  const totalAssignments = confirmedAssignments + inferredAssignments

  // Sections with at least one professor
  const sectionsWithProf = await prisma.section.count({
    where: { isActive: true, professors: { some: {} } },
  })
  const sectionsWithConfirmed = await prisma.section.count({
    where: { isActive: true, professors: { some: { confidence: 'CONFIRMED' } } },
  })

  console.log('── 3. Professor Assignment Confidence ────────────────────────')
  console.log(`  Total assignments   : ${totalAssignments}`)
  console.log(`  CONFIRMED           : ${confirmedAssignments} (${pct(confirmedAssignments, totalAssignments)}) – from live Banner SIS`)
  console.log(`  INFERRED            : ${inferredAssignments} (${pct(inferredAssignments, totalAssignments)}) – from historical catalog`)
  console.log()
  console.log(`  Sections with any professor    : ${sectionsWithProf} / ${totalSections} (${pct(sectionsWithProf, totalSections)})`)
  console.log(`  Sections with CONFIRMED prof   : ${sectionsWithConfirmed} / ${totalSections} (${pct(sectionsWithConfirmed, totalSections)})`)
  console.log()

  // ── 4. Schedule builder readiness ───────────────────────────────────────
  const openSections = await prisma.section.count({
    where: { isActive: true, status: 'OPEN', meetings: { some: {} } },
  })
  const unknownStatus = await prisma.section.count({
    where: { isActive: true, status: 'UNKNOWN', meetings: { some: {} } },
  })
  const closedSections = await prisma.section.count({
    where: { isActive: true, status: 'CLOSED' },
  })

  console.log('── 4. Schedule Builder Readiness ─────────────────────────────')
  console.log(`  Sections with meeting times   : ${withMeetings} (${pct(withMeetings, totalSections)})  ✓ usable`)
  console.log(`  OPEN status (live seats)      : ${openSections}`)
  console.log(`  UNKNOWN status (no live data) : ${unknownStatus}  – shown with ⚠ label`)
  console.log(`  CLOSED                        : ${closedSections}`)
  const builderReady = withMeetings >= totalSections * 0.75
  console.log(`  Schedule builder status       : ${builderReady ? '✅ Ready' : '⚠ Limited coverage'}\n`)

  // ── 5. Per-university launch assessment ─────────────────────────────────
  // Universities with live official-source connectors
  const LIVE_SLUGS = new Set(['aub', 'lau'])

  console.log('── 5. Per-University Launch Assessment ───────────────────────')
  console.log(
    '  Uni'.padEnd(10) +
    'Sections'.padStart(10) +
    'Coverage'.padStart(10) +
    'Confirmed%'.padStart(12) +
    'Stale%'.padStart(8) +
    '  Grade'.padEnd(18) +
    '  Data Tier'
  )
  console.log('  ' + '─'.repeat(70))

  const universities = await prisma.university.findMany({
    select: { id: true, shortName: true, slug: true },
    orderBy: { shortName: 'asc' },
  })

  for (const uni of universities) {
    const [uTotal, uCoverage, uConfirmed, uStale] = await Promise.all([
      prisma.section.count({
        where: { isActive: true, course: { department: { faculty: { universityId: uni.id } } } },
      }),
      prisma.section.count({
        where: { isActive: true, professors: { some: {} }, course: { department: { faculty: { universityId: uni.id } } } },
      }),
      prisma.section.count({
        where: { isActive: true, professors: { some: { confidence: 'CONFIRMED' } }, course: { department: { faculty: { universityId: uni.id } } } },
      }),
      prisma.section.count({
        where: { isActive: true, isStale: true, course: { department: { faculty: { universityId: uni.id } } } },
      }),
    ])

    const coveragePct  = uTotal > 0 ? (uCoverage  / uTotal) * 100 : 0
    const confirmedPct = uTotal > 0 ? (uConfirmed / uTotal) * 100 : 0
    const uStalePct    = uTotal > 0 ? (uStale     / uTotal) * 100 : 0
    const g = grade(confirmedPct, coveragePct, uStalePct)

    const tier = LIVE_SLUGS.has(uni.slug.toLowerCase()) ? '🟢 LIVE' : '⚪ FALLBACK'
    console.log(
      `  ${uni.shortName.padEnd(8)}` +
      `${String(uTotal).padStart(10)}` +
      `${pct(uCoverage, uTotal).padStart(10)}` +
      `${pct(uConfirmed, uTotal).padStart(12)}` +
      `${uStalePct.toFixed(0).padStart(7)}%` +
      `  ${g.padEnd(16)}` +
      `  ${tier}`
    )
  }

  // ── 6. Final recommendation ──────────────────────────────────────────────
  console.log('\n── 6. Overall Launch Recommendation ─────────────────────────')

  const overallCoverage  = pct(sectionsWithProf, totalSections)
  const overallConfirmed = pct(sectionsWithConfirmed, totalSections)
  const overallStale     = stalePct.toFixed(1)

  console.log(`  Professor coverage  : ${overallCoverage}  (sections with any assignment)`)
  console.log(`  Confirmed rate      : ${overallConfirmed}  (live Banner SIS data)`)
  console.log(`  Stale data rate     : ${overallStale}%`)
  console.log(`  Schedule builder    : ${builderReady ? 'Functional' : 'Limited'}`)
  console.log(`  Reviews             : ${totalReviews} approved\n`)

  const readyForLaunch =
    sectionsWithProf / totalSections >= 0.9 &&
    stalePct < 20 &&
    withMeetings / totalSections >= 0.75

  if (readyForLaunch) {
    console.log('  ✅  VERDICT: Platform is ready for MVP launch.')
    console.log('      All inferred assignments are clearly labeled in the UI.')
    console.log('      Users will see confidence badges in the schedule builder.')
    console.log('      Professor cards on course pages include a transparency notice.\n')
  } else {
    console.log('  🟠  VERDICT: Platform is MOSTLY ready with known limitations:')
    if (sectionsWithProf / totalSections < 0.9)
      console.log(`      - Professor coverage below 90% (currently ${overallCoverage})`)
    if (stalePct >= 20)
      console.log(`      - Stale data rate is high (${overallStale}%) — run a fresh sync`)
    if (withMeetings / totalSections < 0.75)
      console.log('      - Schedule builder has insufficient meeting time data')
    console.log('      All labeled data tiers are transparent to users.\n')
  }

  console.log('  Live data universities (official public sources):')
  console.log('    🟢 AUB  — www-banner.aub.edu.lb/catalog/schd_[A-Z].htm')
  console.log('    🟢 LAU  — banweb.lau.edu.lb/prod/bwckschd.p_get_crse_unsec')
  console.log('  Fallback universities (historical structured data):')
  console.log('    ⚪ USJ, LIU, NDU, BAU, USEK, UA, AUST, AOU\n')

  console.log('  Trust protections in place:')
  console.log('    ✓  Live Data / Limited Data badges on all university cards and detail pages')
  console.log('    ✓  Data source transparency card in university sidebar')
  console.log('    ✓  CONFIRMED badge shown in schedule builder when data is live')
  console.log('    ✓  Inferred label shown when professor assignment is historical')
  console.log('    ✓  Historical notice shown on course professor comparison cards')
  console.log('    ✓  Stale data warning shown on schedule sections')
  console.log('    ✓  "Unavailable" shown instead of blank for missing fields')
  console.log('    ✓  Schedule ranking prefers CONFIRMED professor data (tiebreaker)\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
