/**
 * Seat Alert Checker — admin/cron endpoint
 *
 * POST /api/seat-alerts/check
 *
 * Scans all active SeatAlerts, compares current seatsRemaining against each
 * alert's threshold, and creates an in-app Notification for qualifying users.
 * Call this from a cron job or manually via the admin sync panel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function isCronAuthorized(req: NextRequest): boolean {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (bearer && process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return true
  const legacy = req.headers.get('x-cron-secret')
  if (legacy && process.env.CRON_SECRET && legacy === process.env.CRON_SECRET) return true
  return false
}

// GET — called by Vercel Cron
export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  // Allow Vercel cron secret OR admin session
  if (!isCronAuthorized(req)) {
    const session = await auth()
    if (!session?.user || !['ADMIN', 'MODERATOR'].includes((session.user as { role?: string }).role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  }

  try {
    // Fetch all active alerts where section is now OPEN / has seats
    const alerts = await prisma.seatAlert.findMany({
      where: { isActive: true },
      include: {
        section: {
          select: {
            id: true,
            sectionNumber: true,
            crn: true,
            status: true,
            seatsRemaining: true,
            course: { select: { code: true, name: true, slug: true } },
          },
        },
      },
    })

    let notified = 0

    for (const alert of alerts) {
      const { section } = alert
      const seats = section.seatsRemaining ?? 0
      const isOpen = section.status === 'OPEN' && seats >= alert.threshold

      if (!isOpen) continue

      // Don't re-notify if already notified recently (within 24h)
      if (alert.notifiedAt) {
        const hoursSince = (Date.now() - alert.notifiedAt.getTime()) / 3_600_000
        if (hoursSince < 24) continue
      }

      const courseName = `${section.course.code} — ${section.course.name}`
      const message = `${seats} seat${seats === 1 ? '' : 's'} just opened in ${courseName} §${section.sectionNumber}${section.crn ? ` (CRN ${section.crn})` : ''}.`

      // Create in-app notification
      await prisma.notification.create({
        data: {
          userId: alert.userId,
          type: 'SEAT_ALERT',
          title: `Seats available: ${section.course.code} §${section.sectionNumber}`,
          body: message,
          link: `/schedule-builder`,
        },
      })

      // Mark alert as notified (to avoid flooding)
      await prisma.seatAlert.update({
        where: { id: alert.id },
        data: { notifiedAt: new Date() },
      })

      notified++
    }

    return NextResponse.json({ ok: true, checked: alerts.length, notified })
  } catch (err) {
    console.error('POST /api/seat-alerts/check error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
