/**
 * Seat Alert API (Part 9)
 *
 * POST   /api/seat-alerts         — subscribe to a section's seat availability
 * DELETE /api/seat-alerts         — unsubscribe
 * GET    /api/seat-alerts         — list current user's active alerts
 * POST   /api/seat-alerts/check   — (admin/cron) check all alerts and fire notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { trackEvent } from '@/lib/analytics'

const SubscribeSchema = z.object({
  sectionId: z.string().min(1).max(50),
  threshold: z.number().int().min(1).max(999).default(1),
})

const UnsubscribeSchema = z.object({
  sectionId: z.string().min(1).max(50),
})

// ── Subscribe ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 10 seat alert subscriptions per minute per IP
  if (!rateLimit(getClientKey(req, 'seat-alerts'), 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = SubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { sectionId, threshold } = parsed.data

    // Verify section exists
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true, courseId: true, sectionNumber: true, status: true, seatsRemaining: true },
    })
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const alert = await prisma.seatAlert.upsert({
      where: { userId_sectionId: { userId: session.user.id, sectionId } },
      update: { threshold, isActive: true },
      create: { userId: session.user.id, sectionId, threshold },
    })

    trackEvent('seat_alert_created', { sectionId, threshold }).catch(() => {})

    return NextResponse.json({ ok: true, id: alert.id, status: section.status, seatsRemaining: section.seatsRemaining }, { status: 201 })
  } catch (err) {
    console.error('POST /api/seat-alerts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Unsubscribe ──────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = UnsubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    await prisma.seatAlert.updateMany({
      where: { userId: session.user.id, sectionId: parsed.data.sectionId },
      data: { isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/seat-alerts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── List active alerts ───────────────────────────────────────────────────────

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const alerts = await prisma.seatAlert.findMany({
      where: { userId: session.user.id, isActive: true },
      include: {
        section: {
          select: {
            id: true,
            sectionNumber: true,
            crn: true,
            status: true,
            seatsRemaining: true,
            capacity: true,
            course: { select: { code: true, name: true } },
            term: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('GET /api/seat-alerts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
