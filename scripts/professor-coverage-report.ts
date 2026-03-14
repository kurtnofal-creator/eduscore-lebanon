/**
 * Professor Assignment Coverage Report
 *
 * Queries section → SectionProfessor data per university and reports:
 *   - Total sections
 *   - Sections with ≥1 CONFIRMED professor assignment
 *   - Sections with ≥1 INFERRED professor assignment (and no CONFIRMED)
 *   - Sections with no professor assignment at all (UNKNOWN)
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/professor-coverage-report.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n====================================================')
  console.log('  EduScore Lebanon – Professor Coverage Report')
  console.log('====================================================\n')

  const universities = await prisma.university.findMany({
    select: { id: true, shortName: true, name: true },
    orderBy: { shortName: 'asc' },
  })

  const globalTotals = { sections: 0, confirmed: 0, inferred: 0, unknown: 0 }

  const rows: Array<{
    uni: string
    total: number
    confirmed: number
    inferred: number
    unknown: number
    confirmedPct: string
    coveragePct: string
  }> = []

  for (const uni of universities) {
    // All active sections for this university
    const sections = await prisma.section.findMany({
      where: {
        isActive: true,
        course: { department: { faculty: { universityId: uni.id } } },
      },
      select: {
        id: true,
        professors: { select: { confidence: true } },
      },
    })

    let confirmed = 0
    let inferred = 0
    let unknown = 0

    for (const sec of sections) {
      if (sec.professors.length === 0) {
        unknown++
      } else if (sec.professors.some(p => p.confidence === 'CONFIRMED')) {
        confirmed++
      } else {
        inferred++  // all are INFERRED
      }
    }

    const total = sections.length
    const coverageCount = confirmed + inferred  // sections with any professor
    const confirmedPct = total > 0 ? ((confirmed / total) * 100).toFixed(1) : '0.0'
    const coveragePct = total > 0 ? ((coverageCount / total) * 100).toFixed(1) : '0.0'

    globalTotals.sections += total
    globalTotals.confirmed += confirmed
    globalTotals.inferred += inferred
    globalTotals.unknown += unknown

    rows.push({ uni: uni.shortName, total, confirmed, inferred, unknown, confirmedPct, coveragePct })
  }

  // Table header
  const col = (s: string, w: number) => s.padEnd(w)
  const rCol = (s: string, w: number) => s.padStart(w)

  console.log(
    col('University', 10) +
    rCol('Sections', 10) +
    rCol('Confirmed', 11) +
    rCol('Inferred', 10) +
    rCol('Unknown', 9) +
    rCol('Confirmed%', 12) +
    rCol('Coverage%', 11)
  )
  console.log('─'.repeat(73))

  for (const r of rows) {
    const confirmedFlag = parseFloat(r.confirmedPct) > 0 ? '' : ' ⚠'
    const coverageFlag  = parseFloat(r.coveragePct) < 80 ? ' ⚠' : ''
    console.log(
      col(r.uni, 10) +
      rCol(String(r.total), 10) +
      rCol(String(r.confirmed), 11) +
      rCol(String(r.inferred), 10) +
      rCol(String(r.unknown), 9) +
      rCol(`${r.confirmedPct}%${confirmedFlag}`, 12) +
      rCol(`${r.coveragePct}%${coverageFlag}`, 11)
    )
  }

  console.log('─'.repeat(73))
  const gCoverage = globalTotals.sections > 0
    ? (((globalTotals.confirmed + globalTotals.inferred) / globalTotals.sections) * 100).toFixed(1)
    : '0.0'
  const gConfirmed = globalTotals.sections > 0
    ? ((globalTotals.confirmed / globalTotals.sections) * 100).toFixed(1)
    : '0.0'
  console.log(
    col('TOTAL', 10) +
    rCol(String(globalTotals.sections), 10) +
    rCol(String(globalTotals.confirmed), 11) +
    rCol(String(globalTotals.inferred), 10) +
    rCol(String(globalTotals.unknown), 9) +
    rCol(`${gConfirmed}%`, 12) +
    rCol(`${gCoverage}%`, 11)
  )

  console.log('\n⚠  = needs attention\n')
  console.log('Confidence definitions:')
  console.log('  CONFIRMED  – professor name extracted from live Banner SIS data')
  console.log('  INFERRED   – assignment matched from historical catalog or department pool')
  console.log('  UNKNOWN    – no professor assigned (section has no SectionProfessor record)\n')

  // Per-university breakdown of confidence quality
  console.log('Launch Safety Assessment:')
  console.log('─'.repeat(50))
  for (const r of rows) {
    const confirmedPct = parseFloat(r.confirmedPct)
    const coveragePct  = parseFloat(r.coveragePct)
    let status: string
    if (confirmedPct > 50)             status = '✅  Safe for launch (confirmed data)'
    else if (coveragePct >= 95)        status = '🟡  Acceptable (inferred, full coverage)'
    else if (coveragePct >= 70)        status = '🟠  Marginal (some sections unassigned)'
    else                               status = '🔴  Not ready (low coverage)'
    console.log(`  ${r.uni.padEnd(8)}  ${status}`)
  }
  console.log()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
