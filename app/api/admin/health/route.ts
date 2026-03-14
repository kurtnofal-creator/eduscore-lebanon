/**
 * Admin Health Stats API
 * GET /api/admin/health
 *
 * Returns connector health, section counts, stale data, seat alert activity,
 * open issue reports, and pending reviews for the monitoring dashboard.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user || !['ADMIN', 'MODERATOR'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalSections,
      staleSections,
      openSections,
      pendingReviews,
      openDataReports,
      activeSeatAlerts,
      seatAlertNotifications24h,
      healthCriticals7d,
      healthWarnings7d,
      recentSyncJobs,
      feedbackCount,
    ] = await Promise.all([
      prisma.section.count({ where: { isActive: true } }),
      prisma.section.count({ where: { isActive: true, isStale: true } }),
      prisma.section.count({ where: { isActive: true, status: 'OPEN' } }),
      prisma.moderationQueue.count({ where: { status: 'PENDING' } }),
      prisma.dataReport.count({ where: { status: 'OPEN' } }),
      prisma.seatAlert.count({ where: { isActive: true } }),
      prisma.notification.count({
        where: { type: 'SEAT_ALERT', createdAt: { gte: since24h } },
      }),
      prisma.analyticsEvent.count({
        where: { event: 'health_check_critical', createdAt: { gte: since7d } },
      }),
      prisma.analyticsEvent.count({
        where: { event: 'health_check_warning', createdAt: { gte: since7d } },
      }),
      prisma.syncJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { university: { select: { shortName: true } } },
      }),
      prisma.feedback.count({ where: { createdAt: { gte: since7d } } }),
    ])

    // Latest health check results per university
    const latestHealthChecks = await prisma.analyticsEvent.findMany({
      where: { event: 'health_check_complete' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Parse the latest result per university
    const healthByUniversity: Record<string, {
      healthScore: number
      passed: boolean
      totalSections: number
      staleSections: number
      crnCoverageRate: number
      checkedAt: Date
    }> = {}
    for (const ev of latestHealthChecks) {
      const props = typeof ev.properties === 'string'
        ? JSON.parse(ev.properties) as Record<string, unknown>
        : {}
      const uni = props.university as string | undefined
      if (uni && !healthByUniversity[uni]) {
        healthByUniversity[uni] = {
          healthScore:    props.healthScore    as number ?? 0,
          passed:         props.passed         as boolean ?? false,
          totalSections:  props.totalSections  as number ?? 0,
          staleSections:  props.staleSections  as number ?? 0,
          crnCoverageRate: props.crnCoverageRate as number ?? 0,
          checkedAt:      ev.createdAt,
        }
      }
    }

    const stalePercent = totalSections > 0 ? Math.round((staleSections / totalSections) * 100) : 0
    const connectorDegraded = Object.values(healthByUniversity).some(h => !h.passed)

    return NextResponse.json({
      sections: {
        total: totalSections,
        stale: staleSections,
        stalePercent,
        open: openSections,
      },
      reviews: {
        pending: pendingReviews,
      },
      dataReports: {
        open: openDataReports,
      },
      seatAlerts: {
        active: activeSeatAlerts,
        notified24h: seatAlertNotifications24h,
      },
      connector: {
        degraded: connectorDegraded,
        criticals7d: healthCriticals7d,
        warnings7d: healthWarnings7d,
        byUniversity: healthByUniversity,
      },
      feedback: {
        last7d: feedbackCount,
      },
      recentSyncJobs: recentSyncJobs.map(j => ({
        id: j.id,
        university: j.university.shortName,
        type: j.type,
        status: j.status,
        createdAt: j.createdAt,
        errorMessage: j.errorMessage ?? null,
      })),
    })
  } catch (err) {
    console.error('GET /api/admin/health error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
