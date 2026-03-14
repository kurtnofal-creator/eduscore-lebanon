import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateSchedules, type SchedulePreference, type SectionData } from '@/lib/schedule-engine'
import { trackEvent } from '@/lib/analytics'
import { rateLimit, getClientKey } from '@/lib/rateLimit'

const ScheduleRequestSchema = z.object({
  courseIds: z.array(z.string()).min(1).max(10),
  termId: z.string(),
  preference: z.enum([
    'best_professors',
    'light_workload',
    'fewer_days',
    'short_gaps',
    'early_start',
    'late_start',
    'balanced',
  ]).default('balanced'),
  maxResults: z.number().int().min(1).max(30).default(20),
  // Professor filters (Part 7)
  minProfRating: z.number().min(0).max(5).default(0),
  confirmedOnly: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  // 60 schedule generations per minute per IP (protects against bots; real users rarely exceed 5)
  if (!rateLimit(getClientKey(req, 'schedule'), 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = ScheduleRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { courseIds, termId, preference, maxResults, minProfRating, confirmedOnly } = parsed.data

    // Fetch all active sections for the requested courses in the given term
    const sections = await prisma.section.findMany({
      where: {
        courseId: { in: courseIds },
        termId,
        isActive: true,
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
        professors: {
          select: {
            confidence: true,
            isPrimary: true,
            professor: {
              select: {
                id: true,
                fullName: true,
                overallRating: true,
                workloadLevel: true,
              },
            },
          },
        },
        meetings: true,
      },
      // Select freshness fields explicitly via include (all fields returned by default)
    })

    // Build the map of courseId → SectionData[]
    const courseOptions = new Map<string, SectionData[]>()

    for (const courseId of courseIds) {
      const courseSections: SectionData[] = sections
        .filter(s => s.courseId === courseId)
        .map(s => ({
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
          crn: s.crn,
          status: s.status,
          seatsRemaining: s.seatsRemaining,
          capacity: s.capacity,
          enrolled: s.enrolled,
          isStale: s.isStale,
          completenessScore: s.completenessScore,
          dataQualityStatus: s.dataQualityStatus,
          historicalInference: s.historicalInference,
          lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
        }))

      // Apply professor filters (Part 7)
      const filtered = courseSections.filter(s => {
        // If confirmedOnly: skip sections where all professors are INFERRED (allow TBA sections through)
        if (confirmedOnly && s.professors.length > 0) {
          const hasConfirmed = s.professors.some(p => p.confidence === 'CONFIRMED')
          if (!hasConfirmed) return false
        }
        // If minProfRating > 0: skip sections whose best-rated professor is below threshold
        if (minProfRating > 0 && s.professors.length > 0) {
          const bestRating = Math.max(...s.professors.map(p => p.overallRating ?? 0))
          if (bestRating < minProfRating) return false
        }
        return true
      })

      if (filtered.length > 0) {
        courseOptions.set(courseId, filtered)
      } else if (courseSections.length > 0) {
        // Filters removed all options for this course — fall back to unfiltered
        // so the user gets a result rather than a "no sections" error
        courseOptions.set(courseId, courseSections)
      }
    }

    // Check if any requested course has no sections
    const missingCourses = courseIds.filter(id => !courseOptions.has(id))
    if (missingCourses.length > 0) {
      const courseNames = await prisma.course.findMany({
        where: { id: { in: missingCourses } },
        select: { id: true, code: true, name: true },
      })
      return NextResponse.json({
        error: 'Some courses have no available sections for this term',
        missingCourses: courseNames,
      }, { status: 422 })
    }

    // Generate schedules
    let schedules
    try {
      schedules = generateSchedules(courseOptions, preference as SchedulePreference, maxResults)
    } catch (genErr) {
      trackEvent('error', { type: 'schedule_generation', message: String(genErr), courseCount: courseIds.length }).catch(() => {})
      throw genErr
    }

    trackEvent('schedule_generated', { preference, courseCount: courseIds.length, resultsFound: schedules.length }).catch(() => {})

    return NextResponse.json({
      schedules,
      totalFound: schedules.length,
      term: await prisma.academicTerm.findUnique({
        where: { id: termId },
        select: { name: true, season: true, year: true },
      }),
    })
  } catch (error) {
    console.error('POST /api/schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
