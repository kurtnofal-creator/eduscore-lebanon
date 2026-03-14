import { prisma } from '@/lib/db'

type EventProperties = Record<string, string | number | boolean | null>

/**
 * Track a server-side analytics event.
 * These are stored in the DB for admin dashboards.
 */
export async function trackEvent(
  event: string,
  properties?: EventProperties & {
    page?: string
    referrer?: string
    sessionId?: string
    countryCode?: string
  }
): Promise<void> {
  try {
    const { page, referrer, sessionId, countryCode, ...rest } = properties ?? {}
    await prisma.analyticsEvent.create({
      data: {
        event,
        page,
        referrer,
        sessionId,
        countryCode,
        properties: Object.keys(rest).length > 0 ? JSON.stringify(rest) : undefined,
      },
    })
  } catch {
    // Never let analytics break the app
  }
}

/**
 * Get aggregate analytics for the admin dashboard.
 */
export async function getDashboardStats(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [
    totalEvents,
    pageViews,
    searches,
    schedulesGenerated,
    reviewsSubmitted,
    popularPages,
    topSearches,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),

    prisma.analyticsEvent.count({
      where: { event: 'page_view', createdAt: { gte: since } },
    }),

    prisma.analyticsEvent.count({
      where: { event: 'search', createdAt: { gte: since } },
    }),

    prisma.analyticsEvent.count({
      where: { event: 'schedule_generated', createdAt: { gte: since } },
    }),

    prisma.analyticsEvent.count({
      where: { event: 'review_submitted', createdAt: { gte: since } },
    }),

    prisma.analyticsEvent.groupBy({
      by: ['page'],
      where: { event: 'page_view', page: { not: null }, createdAt: { gte: since } },
      _count: { page: true },
      orderBy: { _count: { page: 'desc' } },
      take: 10,
    }),

    prisma.analyticsEvent.findMany({
      where: { event: 'search', createdAt: { gte: since } },
      select: { properties: true },
      take: 200,
    }),
  ])

  // Process top searches from event properties
  const searchTermCounts: Record<string, number> = {}
  for (const ev of topSearches) {
    const props = typeof ev.properties === 'string'
      ? JSON.parse(ev.properties) as Record<string, unknown>
      : ev.properties as Record<string, unknown> | null
    const q = props?.query as string | undefined
    if (q) searchTermCounts[q] = (searchTermCounts[q] ?? 0) + 1
  }
  const topSearchTerms = Object.entries(searchTermCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }))

  return {
    totalEvents,
    pageViews,
    searches,
    schedulesGenerated,
    reviewsSubmitted,
    popularPages: popularPages.map(p => ({ page: p.page!, count: p._count.page })),
    topSearchTerms,
  }
}
