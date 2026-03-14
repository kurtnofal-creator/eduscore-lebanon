/**
 * EduScore Lebanon – Course & Section Deduplication
 *
 * Fixes: the LAU sync created duplicate Course records when department
 * mappings changed between runs (same code → different deptId → new Course).
 * This script merges duplicates and removes the orphaned sections.
 *
 * Run (one-time cleanup):
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/dedup-courses.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  EduScore Lebanon – Course & Section Deduplication')
  console.log('══════════════════════════════════════════════════════\n')

  // ── Step 1: Find all duplicate course codes ──────────────────────────────
  const dupCodes = await prisma.$queryRaw<Array<{ code: string }>>`
    SELECT code FROM Course WHERE isActive = 1
    GROUP BY code HAVING COUNT(*) > 1
  `
  console.log(`Found ${dupCodes.length} course codes with duplicates\n`)

  let mergedCourses = 0, movedSections = 0, deletedCourses = 0

  for (const { code } of dupCodes) {
    // Get all courses with this code
    const courses = await prisma.course.findMany({
      where: { code, isActive: true },
      select: {
        id: true, code: true, name: true, departmentId: true, reviewCount: true,
        _count: { select: { sections: { where: { isActive: true } }, reviews: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (courses.length < 2) continue

    // Winner: course with the most sections (tie-break: oldest = first created)
    const winner = courses.reduce((best, c) =>
      c._count.sections > best._count.sections ? c : best
    , courses[0])

    const losers = courses.filter(c => c.id !== winner.id)

    for (const loser of losers) {
      // Move sections from loser → winner, but only if winner doesn't already have that section
      const loserSections = await prisma.section.findMany({
        where: { courseId: loser.id },
        select: { id: true, termId: true, sectionNumber: true },
      })
      for (const ls of loserSections) {
        const conflict = await prisma.section.findFirst({
          where: { courseId: winner.id, termId: ls.termId, sectionNumber: ls.sectionNumber },
        })
        if (conflict) {
          // Winner already has this section — deactivate the loser's copy
          await prisma.sectionMeeting.deleteMany({ where: { sectionId: ls.id } })
          await prisma.sectionProfessor.deleteMany({ where: { sectionId: ls.id } })
          await prisma.section.update({ where: { id: ls.id }, data: { isActive: false } })
        } else {
          // Safe to move
          await prisma.section.update({ where: { id: ls.id }, data: { courseId: winner.id } })
          movedSections++
        }
      }

      // Move reviews from loser → winner
      await prisma.review.updateMany({
        where: { courseId: loser.id },
        data: { courseId: winner.id },
      })

      // Move professorCourses, skipping duplicates
      const loserProfCourses = await prisma.professorCourse.findMany({
        where: { courseId: loser.id },
        select: { professorId: true, courseId: true },
      })
      for (const pc of loserProfCourses) {
        await prisma.professorCourse.upsert({
          where: { professorId_courseId: { professorId: pc.professorId, courseId: winner.id } },
          update: {},
          create: { professorId: pc.professorId, courseId: winner.id },
        })
        await prisma.professorCourse.deleteMany({
          where: { professorId: pc.professorId, courseId: loser.id },
        })
      }

      // Delete the loser course
      await prisma.course.delete({ where: { id: loser.id } }).catch(() => {
        // If delete fails (FK constraints), mark inactive instead
        return prisma.course.update({ where: { id: loser.id }, data: { isActive: false } })
      })
      deletedCourses++
    }
    mergedCourses++
  }

  console.log(`✅ Merged ${mergedCourses} duplicate course groups`)
  console.log(`   Moved ${movedSections} sections to canonical courses`)
  console.log(`   Removed ${deletedCourses} duplicate course records`)

  // ── Step 2: Deduplicate sections with same CRN + termId ──────────────────
  console.log('\nStep 2: Removing duplicate sections (same CRN + term)...')

  const dupSections = await prisma.$queryRaw<Array<{ crn: string; termId: string }>>`
    SELECT crn, termId FROM Section
    WHERE crn IS NOT NULL AND isActive = 1
    GROUP BY crn, termId
    HAVING COUNT(*) > 1
  `
  console.log(`Found ${dupSections.length} duplicate CRN+term pairs`)

  let deletedSections = 0

  for (const { crn, termId } of dupSections) {
    const secs = await prisma.section.findMany({
      where: { crn, termId, isActive: true },
      select: {
        id: true,
        _count: { select: { meetings: true, professors: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (secs.length < 2) continue

    // Winner: section with the most meetings + professors (richest data)
    const winner = secs.reduce((best, s) =>
      (s._count.meetings + s._count.professors) > (best._count.meetings + best._count.professors) ? s : best
    , secs[0])

    const losers = secs.filter(s => s.id !== winner.id)

    for (const loser of losers) {
      // Delete meetings and professor assignments for loser
      await prisma.sectionMeeting.deleteMany({ where: { sectionId: loser.id } })
      await prisma.sectionProfessor.deleteMany({ where: { sectionId: loser.id } })
      // Deactivate (don't hard-delete in case there are FK references)
      await prisma.section.update({ where: { id: loser.id }, data: { isActive: false } })
      deletedSections++
    }
  }

  console.log(`✅ Deactivated ${deletedSections} duplicate section records`)

  // ── Step 3: Recompute course review counts ───────────────────────────────
  console.log('\nStep 3: Recomputing course review counts...')
  const coursesWithReviews = await prisma.course.findMany({
    where: { isActive: true, reviews: { some: {} } },
    select: { id: true, _count: { select: { reviews: { where: { status: 'APPROVED' } } } } },
  })
  let recalculated = 0
  for (const c of coursesWithReviews) {
    await prisma.course.update({
      where: { id: c.id },
      data: { reviewCount: c._count.reviews },
    })
    recalculated++
  }
  console.log(`✅ Recomputed reviewCount for ${recalculated} courses`)

  // ── Final verification ───────────────────────────────────────────────────
  console.log('\nVerification:')
  const remainingDupCodes = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) as c FROM (
      SELECT code FROM Course WHERE isActive = 1
      GROUP BY code HAVING COUNT(*) > 1
    )
  `
  const remainingDupSections = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) as c FROM (
      SELECT crn, termId FROM Section
      WHERE crn IS NOT NULL AND isActive = 1
      GROUP BY crn, termId HAVING COUNT(*) > 1
    )
  `
  console.log(`  Remaining duplicate course codes: ${Number(remainingDupCodes[0]?.c ?? 0)}`)
  console.log(`  Remaining duplicate CRN+term pairs: ${Number(remainingDupSections[0]?.c ?? 0)}`)
  console.log('\nDone.')

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
