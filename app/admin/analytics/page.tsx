import { prisma } from '@/lib/db'
import { BarChart2, TrendingUp, Users, BookOpen, Star, Search, Eye, Calendar, Bell } from 'lucide-react'

export default async function AdminAnalyticsPage() {
  const now = new Date()
  const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalStats,
    recentReviews,
    topSearches,
    pageViews7d,
    pageViews30d,
    reviewsBy7d,
    reviewsBy30d,
    schedulesBuilt7d,
    schedulesBuilt30d,
    favoritesAdded7d,
    totalSeatAlerts,
    searches30d,
    topProfessors,
    topCourses,
    reviewsByStatus,
  ] = await Promise.all([
    Promise.all([
      prisma.professor.count({ where: { isActive: true } }),
      prisma.course.count({ where: { isActive: true } }),
      prisma.review.count({ where: { status: 'APPROVED' } }),
      prisma.user.count(),
    ]),
    prisma.review.findMany({
      where: { createdAt: { gte: days7Ago } },
      include: {
        professor: { select: { fullName: true, slug: true } },
        course: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['properties'],
      where: { event: 'search', createdAt: { gte: days30Ago } },
      _count: true,
      orderBy: { _count: { properties: 'desc' } },
      take: 10,
    }),
    prisma.analyticsEvent.count({ where: { event: 'page_view', createdAt: { gte: days7Ago } } }),
    prisma.analyticsEvent.count({ where: { event: 'page_view', createdAt: { gte: days30Ago } } }),
    prisma.review.count({ where: { createdAt: { gte: days7Ago } } }),
    prisma.review.count({ where: { createdAt: { gte: days30Ago } } }),
    prisma.analyticsEvent.count({ where: { event: 'schedule_generated', createdAt: { gte: days7Ago } } }),
    prisma.analyticsEvent.count({ where: { event: 'schedule_generated', createdAt: { gte: days30Ago } } }),
    prisma.watchlistItem.count({ where: { createdAt: { gte: days7Ago } } }),
    prisma.seatAlert.count({ where: { isActive: true } }),
    prisma.analyticsEvent.count({ where: { event: 'search', createdAt: { gte: days30Ago } } }),
    prisma.professor.findMany({
      where: { isActive: true, reviewCount: { gte: 1 } },
      orderBy: { reviewCount: 'desc' },
      take: 10,
      select: { fullName: true, slug: true, reviewCount: true, overallRating: true, department: { select: { faculty: { select: { university: { select: { shortName: true } } } } } } },
    }),
    prisma.course.findMany({
      where: { isActive: true, reviewCount: { gte: 1 } },
      orderBy: { reviewCount: 'desc' },
      take: 10,
      select: { code: true, name: true, slug: true, reviewCount: true, department: { select: { faculty: { select: { university: { select: { shortName: true } } } } } } },
    }),
    prisma.review.groupBy({
      by: ['status'],
      _count: true,
    }),
  ])

  const [profCount, courseCount, reviewCount, userCount] = totalStats

  const statusMap = Object.fromEntries(reviewsByStatus.map(r => [r.status, r._count]))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Platform usage and engagement overview</p>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, label: 'Total Professors', value: profCount.toLocaleString(), color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: BookOpen, label: 'Total Courses', value: courseCount.toLocaleString(), color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { icon: Star, label: 'Approved Reviews', value: reviewCount.toLocaleString(), color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: Users, label: 'Registered Users', value: userCount.toLocaleString(), color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Activity stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Eye,      label: 'Page views (7d)',      value: pageViews7d.toLocaleString() },
          { icon: Eye,      label: 'Page views (30d)',     value: pageViews30d.toLocaleString() },
          { icon: Search,   label: 'Searches (30d)',       value: searches30d.toLocaleString() },
          { icon: Calendar, label: 'Schedules (7d)',       value: schedulesBuilt7d.toLocaleString() },
          { icon: Calendar, label: 'Schedules (30d)',      value: schedulesBuilt30d.toLocaleString() },
          { icon: Star,     label: 'New reviews (30d)',    value: reviewsBy30d.toLocaleString() },
          { icon: Bell,     label: 'Active seat alerts',   value: totalSeatAlerts.toLocaleString() },
          { icon: BarChart2, label: 'Pending moderation', value: (statusMap['PENDING'] ?? 0).toLocaleString() },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Review status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Review Status Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { status: 'APPROVED', color: 'bg-green-500', label: 'Approved' },
              { status: 'PENDING', color: 'bg-amber-500', label: 'Pending' },
              { status: 'FLAGGED', color: 'bg-orange-500', label: 'Flagged' },
              { status: 'REJECTED', color: 'bg-red-500', label: 'Rejected' },
            ].map(({ status, color, label }) => {
              const count = statusMap[status] ?? 0
              const total = Object.values(statusMap).reduce((s, v) => s + v, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-900">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent reviews */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" /> Recent Reviews (7d)
          </h2>
          {recentReviews.length === 0 ? (
            <p className="text-slate-400 text-sm">No new reviews in the last 7 days.</p>
          ) : (
            <div className="space-y-2.5">
              {recentReviews.map(r => (
                <div key={r.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {r.professor?.fullName ?? r.course?.code ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.overallRating && (
                      <span className="text-xs font-bold text-slate-600">{r.overallRating}/5</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'APPROVED' ? 'bg-green-100 text-green-700'
                      : r.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top professors + courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" /> Most Reviewed Professors
          </h2>
          <div className="space-y-2">
            {topProfessors.map((p, i) => (
              <div key={p.slug} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.fullName}</p>
                  <p className="text-xs text-slate-400">{p.department?.faculty?.university?.shortName}</p>
                </div>
                <span className="text-sm font-bold text-slate-600">{p.reviewCount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" /> Most Reviewed Courses
          </h2>
          <div className="space-y-2">
            {topCourses.map((c, i) => (
              <div key={c.slug} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    <span className="font-mono text-blue-600">{c.code}</span> {c.name}
                  </p>
                  <p className="text-xs text-slate-400">{c.department?.faculty?.university?.shortName}</p>
                </div>
                <span className="text-sm font-bold text-slate-600">{c.reviewCount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
