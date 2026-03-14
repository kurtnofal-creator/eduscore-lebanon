import { prisma } from '@/lib/db'
import { getDashboardStats } from '@/lib/analytics'
import { Star, Users, BookOpen, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react'


export const dynamic = 'force-dynamic'
async function getAdminStats() {
  const [
    totalProfessors,
    totalCourses,
    totalReviews,
    pendingReviews,
    totalUsers,
    pendingReports,
    recentSyncJobs,
    analytics,
  ] = await Promise.all([
    prisma.professor.count({ where: { isActive: true } }),
    prisma.course.count({ where: { isActive: true } }),
    prisma.review.count({ where: { status: 'APPROVED' } }),
    prisma.review.count({ where: { status: 'PENDING' } }),
    prisma.user.count(),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.syncJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { university: { select: { shortName: true } } },
    }),
    getDashboardStats(7),
  ])

  return {
    totalProfessors, totalCourses, totalReviews, pendingReviews,
    totalUsers, pendingReports, recentSyncJobs, analytics,
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  }

  return (
    <div className="bg-white rounded-xl border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminDashboard() {
  const stats = await getAdminStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of EduScore Lebanon platform health.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Professors" value={stats.totalProfessors} color="blue" />
        <StatCard icon={BookOpen} label="Total Courses" value={stats.totalCourses} color="green" />
        <StatCard icon={Star} label="Approved Reviews" value={stats.totalReviews} color="purple" />
        <StatCard icon={Clock} label="Pending Reviews" value={stats.pendingReviews}
          sub={stats.pendingReviews > 0 ? 'Needs attention' : 'Queue clear'}
          color={stats.pendingReviews > 0 ? 'yellow' : 'green'} />
        <StatCard icon={Users} label="Registered Users" value={stats.totalUsers} color="blue" />
        <StatCard icon={AlertTriangle} label="Pending Reports" value={stats.pendingReports}
          color={stats.pendingReports > 0 ? 'red' : 'green'} />
        <StatCard icon={TrendingUp} label="Page Views (7d)" value={stats.analytics.pageViews} color="purple" />
        <StatCard icon={RefreshCw} label="Schedules Built (7d)" value={stats.analytics.schedulesGenerated} color="blue" />
      </div>

      {/* Recent sync jobs */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">Recent Sync Jobs</h2>
          <a href="/admin/sync" className="text-sm text-blue-600 hover:underline">Manage →</a>
        </div>
        <div className="divide-y">
          {stats.recentSyncJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-5">No sync jobs yet.</p>
          ) : (
            stats.recentSyncJobs.map(job => (
              <div key={job.id} className="flex items-center gap-4 p-4 text-sm">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  job.status === 'COMPLETED' ? 'bg-green-500'
                  : job.status === 'FAILED' ? 'bg-red-500'
                  : job.status === 'RUNNING' ? 'bg-blue-500 animate-pulse'
                  : 'bg-muted-foreground'
                }`} />
                <span className="font-medium">{job.university.shortName}</span>
                <span className="text-muted-foreground">{job.type}</span>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded ${
                  job.status === 'COMPLETED' ? 'bg-green-50 text-green-700'
                  : job.status === 'FAILED' ? 'bg-red-50 text-red-700'
                  : 'bg-muted text-muted-foreground'
                }`}>{job.status}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top searches */}
      {stats.analytics.topSearchTerms.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Top Searches (7 days)</h2>
          </div>
          <div className="divide-y">
            {stats.analytics.topSearchTerms.map(term => (
              <div key={term.query} className="flex items-center justify-between p-4 text-sm">
                <span>&quot;{term.query}&quot;</span>
                <span className="text-muted-foreground font-medium">{term.count} searches</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
