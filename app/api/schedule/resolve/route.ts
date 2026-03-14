/**
 * Schedule Resolve API — reconstructs a shared schedule from section IDs.
 *
 * POST /api/schedule/resolve
 * Body: { sectionIds: string[], termId: string }
 *
 * Used by the share URL feature: when a user opens a shared link with ?s=<base64>,
 * ScheduleBuilderClient decodes it and calls this endpoint to fetch the full
 * section data needed to render the schedule without re-generating.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { computeScheduleResult } from '@/lib/schedule-engine'
import type { SectionData } from '@/lib/schedule-engine'

const ResolveSchema = z.object({
  sectionIds: z.array(z.string()).min(1).max(10),
  termId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ResolveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { sectionIds } = parsed.data

    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds }, isActive: true },
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
    })

    if (sections.length === 0) {
      return NextResponse.json({ error: 'No sections found — the shared link may be outdated' }, { status: 404 })
    }

    const sectionData: SectionData[] = sections.map(s => ({
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

    // Order by requested sectionIds order
    const ordered = sectionIds
      .map(id => sectionData.find(s => s.id === id))
      .filter((s): s is SectionData => s !== undefined)

    const schedule = computeScheduleResult(ordered, 'balanced')

    return NextResponse.json({ schedule })
  } catch (err) {
    console.error('POST /api/schedule/resolve error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
