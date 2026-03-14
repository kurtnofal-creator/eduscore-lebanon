/**
 * Final AUB + LAU Coverage Summary
 *
 * Generates a comprehensive report of current data state for beta launch review.
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/coverage-summary.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LIVE_UNIVERSITIES = ['aub', 'lau']

async function universityReport(slug: string) {
  const uni = await prisma.university.findUnique({
    where: { slug },
    include: { faculties: { include: { departments: true } } },
  })
  if (!uni) return null

  const currentTerm = await prisma.academicTerm.findFirst({
    where: { universityId: uni.id, isCurrent: true },
    orderBy: { year: 'desc' },
  })

  const [courses, sections, professors, confirmedSections, staleSections, departments] = await Promise.all([
    prisma.course.count({ where: { isActive: true, department: { faculty: { universityId: uni.id } } } }),
    prisma.section.count({ where: { isActive: true, course: { department: { faculty: { universityId: uni.id } } } } }),
    prisma.professor.count({ where: { isActive: true, isMerged: false, department: { faculty: { universityId: uni.id } } } }),
    prisma.sectionProfessor.count({
      where: { confidence: 'CONFIRMED', section: { course: { department: { faculty: { universityId: uni.id } } } } }
    }),
    prisma.section.count({
      where: { isStale: true, course: { department: { faculty: { universityId: uni.id } } } }
    }),
    prisma.department.count({ where: { faculty: { universityId: uni.id } } }),
  ])

  const currentTermSections = currentTerm
    ? await prisma.section.count({ where: { termId: currentTerm.id, isActive: true } })
    : 0

  const confirmedRate = sections > 0 ? Math.round((confirmedSections / sections) * 100) : 0

  // Department breakdown
  const deptStats = await prisma.department.findMany({
    where: { faculty: { universityId: uni.id } },
    include: {
      _count: { select: { courses: true, professors: true } },
    },
    orderBy: { name: 'asc' },
  })

  return {
    slug,
    name: uni.shortName,
    fullName: uni.name,
    currentTerm: currentTerm?.name ?? 'None',
    courses,
    sections,
    currentTermSections,
    professors,
    departments,
    confirmedRate,
    staleSections,
    faculties: uni.faculties.length,
    deptStats,
  }
}

async function main() {
  const now = new Date().toISOString().split('T')[0]

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  EduScore Lebanon — Final Coverage Summary')
  console.log(`  Generated: ${now}`)
  console.log('══════════════════════════════════════════════════════════════\n')

  for (const slug of LIVE_UNIVERSITIES) {
    const r = await universityReport(slug)
    if (!r) { console.log(`  ${slug}: not found\n`); continue }

    const tier = LIVE_UNIVERSITIES.includes(slug) ? '⚡ LIVE DATA' : '🗄 FALLBACK'

    console.log(`  ┌─ ${r.name} — ${r.fullName}`)
    console.log(`  │  Data tier:        ${tier}`)
    console.log(`  │  Current term:     ${r.currentTerm}`)
    console.log(`  │  Faculties:        ${r.faculties}`)
    console.log(`  │  Departments:      ${r.departments}`)
    console.log(`  │  Courses:          ${r.courses}`)
    console.log(`  │  Sections (total): ${r.sections}`)
    console.log(`  │  Sections (term):  ${r.currentTermSections}`)
    console.log(`  │  Professors:       ${r.professors}`)
    console.log(`  │  Confirmed rate:   ${r.confirmedRate}%`)
    console.log(`  │  Stale sections:   ${r.staleSections}`)
    console.log(`  └──`)

    // Department breakdown
    console.log(`\n  Department breakdown (${r.slug.toUpperCase()}):`)
    console.log('  ' + 'Department'.padEnd(42) + 'Code'.padStart(6) + 'Courses'.padStart(9) + 'Profs'.padStart(7))
    console.log('  ' + '─'.repeat(64))
    for (const d of r.deptStats.filter(d => d._count.courses > 0).sort((a, b) => b._count.courses - a._count.courses)) {
      console.log(
        '  ' + d.name.slice(0, 40).padEnd(42) +
        (d.code ?? '—').padStart(6) +
        String(d._count.courses).padStart(9) +
        String(d._count.professors).padStart(7)
      )
    }
    console.log()
  }

  // Platform-wide stats
  const [totalUniversities, totalCourses, totalSections, totalProfessors, totalReviews] = await Promise.all([
    prisma.university.count({ where: { isActive: true } }),
    prisma.course.count({ where: { isActive: true } }),
    prisma.section.count({ where: { isActive: true } }),
    prisma.professor.count({ where: { isActive: true, isMerged: false } }),
    prisma.review.count({ where: { status: 'APPROVED' } }),
  ])

  console.log('  ═══════════════════════════════════════════')
  console.log('  Platform Totals (all universities)')
  console.log('  ═══════════════════════════════════════════')
  console.log(`  Universities: ${totalUniversities}`)
  console.log(`  Courses:      ${totalCourses}`)
  console.log(`  Sections:     ${totalSections}`)
  console.log(`  Professors:   ${totalProfessors}`)
  console.log(`  Reviews:      ${totalReviews}`)

  // Beta launch readiness checklist
  console.log('\n  ═══════════════════════════════════════════')
  console.log('  Beta Launch Readiness Checklist')
  console.log('  ═══════════════════════════════════════════')

  const aubReport = await universityReport('aub')
  const lauReport = await universityReport('lau')

  const checks = [
    { label: 'AUB sections > 3000',         pass: (aubReport?.sections ?? 0) > 3000 },
    { label: 'AUB confirmed rate > 85%',    pass: (aubReport?.confirmedRate ?? 0) > 85 },
    { label: 'AUB departments > 40',        pass: (aubReport?.departments ?? 0) > 40 },
    { label: 'AUB stale sections == 0',     pass: (aubReport?.staleSections ?? 1) === 0 },
    { label: 'LAU sections present',        pass: (lauReport?.sections ?? 0) > 0 },
    { label: 'Total reviews > 2000',        pass: totalReviews > 2000 },
    { label: 'Total professors > 300',      pass: totalProfessors > 300 },
  ]

  let allGreen = true
  for (const c of checks) {
    const icon = c.pass ? '✅' : '❌'
    console.log(`  ${icon} ${c.label}`)
    if (!c.pass) allGreen = false
  }

  console.log()
  if (allGreen) {
    console.log('  🚀 ALL CHECKS PASSED — Ready for beta launch')
  } else {
    console.log('  ⚠️  Some checks failed — review before launch')
  }

  await prisma.$disconnect()
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
