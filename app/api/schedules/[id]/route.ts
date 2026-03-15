import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

// Public GET — fetch a saved schedule by ID for sharing (no auth required)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const schedule = await prisma.savedSchedule.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            section: {
              include: {
                course: {
                  select: { id: true, code: true, name: true, slug: true, credits: true },
                },
                professors: {
                  include: {
                    professor: { select: { id: true, fullName: true, slug: true, overallRating: true } },
                  },
                },
                meetings: true,
                term: { select: { id: true, name: true, year: true, season: true } },
              },
            },
          },
        },
      },
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Return schedule without userId (privacy)
    const { sections, name, createdAt, termId } = schedule
    return NextResponse.json({ schedule: { id: schedule.id, name, termId, createdAt, sections } })
  } catch (error) {
    console.error('GET /api/schedules/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
