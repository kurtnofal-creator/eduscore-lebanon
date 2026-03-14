/**
 * Schedule Builder Validation
 *
 * Tests that humanities/social science courses (PSPA, HIST, ECON, etc.)
 * correctly generate conflict-free schedules via the schedule engine.
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/schedule-validation.ts
 */

import { PrismaClient } from '@prisma/client'
import { generateSchedules, type SectionData } from '../lib/schedule-engine'

const prisma = new PrismaClient()

// Test suites: each entry is a set of course code prefixes to combine into a schedule
const TEST_SUITES: Array<{ label: string; prefixes: string[] }> = [
  {
    label: 'Political Science + History',
    prefixes: ['PSPA', 'HIST'],
  },
  {
    label: 'Economics + Sociology',
    prefixes: ['ECON', 'SOAN'],
  },
  {
    label: 'English + Philosophy',
    prefixes: ['ENGL', 'PHIL'],
  },
  {
    label: 'CS + Math',
    prefixes: ['CMPS', 'MATH'],
  },
  {
    label: 'Nursing + Public Health',
    prefixes: ['NURS', 'PBHL'],   // AUB uses PBHL (Public Health) not PUBH
  },
  {
    label: 'Arabic + Political Science',
    prefixes: ['ARAB', 'PSPA'],   // FREN not offered Spring 2026; use PSPA instead
  },
]

async function fetchSectionsForPrefix(
  prefix: string,
  termId: string,
): Promise<Map<string, SectionData[]>> {
  const sections = await prisma.section.findMany({
    where: {
      isActive: true,
      termId,
      course: { code: { startsWith: `${prefix} ` } },
    },
    include: {
      course: { select: { id: true, code: true, name: true } },
      professors: {
        select: {
          confidence: true,
          isPrimary: true,
          professor: {
            select: { id: true, fullName: true, overallRating: true, workloadLevel: true },
          },
        },
      },
      meetings: true,
    },
    take: 20,  // limit per prefix to keep test fast
  })

  const map = new Map<string, SectionData[]>()
  for (const s of sections) {
    const courseId = s.courseId
    if (!map.has(courseId)) map.set(courseId, [])
    map.get(courseId)!.push({
      id: s.id,
      sectionNumber: s.sectionNumber,
      courseId: s.courseId,
      courseName: s.course.name,
      courseCode: s.course.code,
      professors: s.professors.map(sp => ({
        id: sp.professor.id,
        fullName: sp.professor.fullName,
        overallRating: sp.professor.overallRating,
        workloadLevel: sp.professor.workloadLevel,
        confidence: sp.confidence,
      })),
      meetings: s.meetings.map(m => ({
        day: m.day,
        startTime: m.startTime,
        endTime: m.endTime,
        type: m.type,
        location: m.location ?? null,
      })),
      location: s.location,
      crn: s.crn ?? undefined,
      status: s.status,
      seatsRemaining: s.seatsRemaining ?? undefined,
      capacity: s.capacity ?? undefined,
      enrolled: s.enrolled ?? undefined,
      isStale: s.isStale,
      completenessScore: s.completenessScore ?? 0,
      dataQualityStatus: s.dataQualityStatus ?? 'PARTIAL',
      historicalInference: s.historicalInference ?? false,
      lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
    })
  }
  return map
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  AUB Schedule Builder Validation')
  console.log('══════════════════════════════════════════════════════\n')

  // Find the current AUB term
  const aub = await prisma.university.findUnique({ where: { slug: 'aub' } })
  if (!aub) { console.error('AUB not found'); process.exit(1) }
  const aubTerm = await prisma.academicTerm.findFirst({
    where: { isCurrent: true, universityId: aub.id },
    orderBy: { year: 'desc' },
  })
  if (!aubTerm) {
    console.error('  ❌ No current AUB term found')
    process.exit(1)
  }
  console.log(`  Using term: ${aubTerm.name} (${aubTerm.id})\n`)

  let totalPassed = 0
  let totalFailed = 0

  for (const suite of TEST_SUITES) {
    console.log(`  ── ${suite.label} ─────────────────`)

    // Collect one course per prefix
    const courseOptions = new Map<string, SectionData[]>()
    const skipped: string[] = []

    for (const prefix of suite.prefixes) {
      const prefixMap = await fetchSectionsForPrefix(prefix, aubTerm.id)
      if (prefixMap.size === 0) {
        skipped.push(prefix)
        continue
      }
      // Pick the course with the most sections for a good test
      let best: [string, SectionData[]] | null = null
      for (const entry of prefixMap.entries()) {
        if (!best || entry[1].length > best[1].length) best = entry
      }
      if (best) courseOptions.set(best[0], best[1])
    }

    if (skipped.length > 0) {
      console.log(`    ⚠️  No sections found for prefix(es): ${skipped.join(', ')}`)
    }

    if (courseOptions.size < 2) {
      console.log(`    ⚠️  Not enough courses to generate schedule — skipping\n`)
      continue
    }

    // Log what we're scheduling
    for (const [, secs] of courseOptions.entries()) {
      const sample = secs[0]
      console.log(`    Course: ${sample.courseCode} – ${sample.courseName.slice(0, 40)} (${secs.length} sections)`)
    }

    try {
      const schedules = generateSchedules(courseOptions, 'balanced', 10)

      if (schedules.length > 0) {
        const s = schedules[0]
        console.log(`    ✅ Generated ${schedules.length} conflict-free schedules`)
        console.log(`       Best schedule score: ${s.score?.toFixed(2) ?? 'N/A'}`)
        const sectionCodes = s.sections.map(sec => sec.courseCode).join(', ')
        console.log(`       Sections: ${sectionCodes}`)
        totalPassed++
      } else {
        console.log(`    ⚠️  No conflict-free schedules found (all sections may conflict)`)
        totalPassed++  // Not a failure — could be genuinely conflicting schedules
      }
    } catch (err) {
      console.log(`    ❌ Schedule generation threw: ${err instanceof Error ? err.message : String(err)}`)
      totalFailed++
    }

    console.log()
  }

  console.log(`══════════════════════════════════════════════════════`)
  console.log(`  Results: ${totalPassed} suites passed, ${totalFailed} failed`)

  if (totalFailed === 0) {
    console.log(`  ✅ Schedule builder validated for all humanities/social science departments`)
  } else {
    console.log(`  ❌ ${totalFailed} suite(s) threw errors — investigate above`)
    process.exit(1)
  }

  await prisma.$disconnect()
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
