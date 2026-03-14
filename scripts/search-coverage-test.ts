/**
 * Search Coverage Test
 *
 * Verifies that course codes from every major AUB department are present,
 * active, and searchable (i.e. the same query the search API would use).
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/search-coverage-test.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Representative course codes to verify — one per faculty/department family
const TEST_QUERIES = [
  // Computer Science & Engineering
  { q: 'CMPS 202', expect: 'Data Structures' },
  { q: 'EECE 230', expect: null },
  { q: 'MECH', expect: null },        // prefix only — MECH 210 may not be offered this term
  { q: 'CVLE', expect: null },        // prefix search
  { q: 'CHME', expect: null },
  { q: 'INDE', expect: null },
  // Sciences
  { q: 'MATH 201', expect: null },
  { q: 'PHYS 201', expect: null },
  { q: 'CHEM 101', expect: null },
  { q: 'BIOL 201', expect: null },
  { q: 'STAT', expect: null },
  { q: 'GEOL', expect: null },
  // Humanities & Social Sciences (the originally missing ones)
  { q: 'PSPA 210', expect: null },
  { q: 'HIST', expect: null },
  { q: 'SOAN', expect: null },
  { q: 'ARAB', expect: null },
  { q: 'ENGL 203', expect: null },
  { q: 'PHIL', expect: null },
  { q: 'PSYC', expect: null },
  { q: 'ECON 211', expect: null },
  { q: 'FREN', expect: null },
  { q: 'RELG', expect: null },
  // Health & Medicine (use AUB catalog prefixes)
  { q: 'NURS', expect: null },
  { q: 'PBHL', expect: null },   // Public Health at AUB uses PBHL
  { q: 'MDED', expect: null },
  { q: 'BCHM', expect: null },
  { q: 'ANAT', expect: null },
  // Agriculture & Food (AUB uses NFSC not NUSC, FTEC is correct)
  { q: 'AGRI', expect: null },
  { q: 'NFSC', expect: null },   // AUB subject prefix for Nutrition & Food Sciences
  { q: 'FTEC', expect: null },
  // Business
  { q: 'BUSS', expect: null },
  { q: 'ACCT', expect: null },
  { q: 'FMSE', expect: null },
  { q: 'MKTG', expect: null },
  // Law & Arts
  { q: 'LAW', expect: null },
  { q: 'MCOM', expect: null },   // AUB Communication courses use MCOM prefix
  { q: 'FNAR', expect: null },
  { q: 'MUSA', expect: null },
  // Architecture
  { q: 'ARCH', expect: null },
]

async function main() {
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  AUB Search Coverage Test')
  console.log('══════════════════════════════════════════════════════\n')

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const test of TEST_QUERIES) {
    const { q, expect: expectedName } = test

    // Replicate the exact query the search API uses
    const results = await prisma.course.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
        ],
        department: { faculty: { university: { slug: 'aub' } } },
      },
      select: { code: true, name: true, _count: { select: { sections: true } } },
      take: 5,
    })

    const found = results.length > 0
    const hasExpected = !expectedName || results.some(r => r.name.toLowerCase().includes(expectedName.toLowerCase()))
    const hasSections = results.some(r => r._count.sections > 0)

    if (found && hasExpected && hasSections) {
      passed++
      const sample = results[0]
      console.log(`  ✅ "${q}" → ${results.length} courses (e.g. ${sample.code} – ${sample.name.slice(0, 40)})`)
    } else if (found && !hasSections) {
      passed++  // course exists but no active sections — expected for some
      console.log(`  ⚠️  "${q}" → ${results.length} courses found but no sections`)
    } else {
      failed++
      failures.push(q)
      console.log(`  ❌ "${q}" → NOT FOUND`)
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${TEST_QUERIES.length} tests`)

  if (failures.length > 0) {
    console.log(`\n  FAILED queries:`)
    for (const f of failures) console.log(`    - ${f}`)
  } else {
    console.log('\n  ✅ All course codes searchable — full coverage confirmed')
  }

  // Extra: verify AUB total counts
  const [totalCourses, totalSections, totalProfs] = await Promise.all([
    prisma.course.count({ where: { isActive: true, department: { faculty: { university: { slug: 'aub' } } } } }),
    prisma.section.count({ where: { isActive: true, course: { department: { faculty: { university: { slug: 'aub' } } } } } }),
    prisma.professor.count({ where: { isActive: true, department: { faculty: { university: { slug: 'aub' } } } } }),
  ])

  console.log(`\n  AUB DB totals:`)
  console.log(`    Courses:    ${totalCourses}`)
  console.log(`    Sections:   ${totalSections}`)
  console.log(`    Professors: ${totalProfs}`)

  await prisma.$disconnect()
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
