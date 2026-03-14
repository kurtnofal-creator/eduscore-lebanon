import { prisma } from '@/lib/db'
import Link from 'next/link'
import { AlertTriangle, User, ChevronRight, Flag, CheckCircle } from 'lucide-react'

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminReportsPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status ?? 'PENDING'
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const perPage = 20

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: { status },
      include: {
        review: {
          select: {
            id: true, body: true, overallRating: true, status: true,
            professor: { select: { fullName: true, slug: true } },
            course: { select: { code: true, name: true, slug: true } },
          },
        },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.report.count({ where: { status } }),
  ])

  const statusCounts = await prisma.report.groupBy({
    by: ['status'],
    _count: true,
  })
  const statusMap = Object.fromEntries(statusCounts.map(s => [s.status, s._count]))

  const STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED']

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" /> Reports
        </h1>
        <p className="text-slate-500 text-sm mt-1">User-reported reviews requiring attention</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {STATUSES.map(s => (
          <Link key={s} href={`/admin/reports?status=${s}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              status === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s} <span className="ml-1 text-xs opacity-70">({statusMap[s] ?? 0})</span>
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center">
          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No {status.toLowerCase()} reports</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <div key={report.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      report.reason === 'HARASSMENT' ? 'bg-red-100 text-red-700'
                      : report.reason === 'SPAM' ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Flag className="h-2.5 w-2.5 inline mr-1" />{report.reason}
                    </span>
                    {report.review.professor && (
                      <Link href={`/professors/${report.review.professor.slug}`} target="_blank"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <User className="h-3 w-3" /> {report.review.professor.fullName}
                      </Link>
                    )}
                    {report.review.course && (
                      <span className="text-xs text-slate-500 font-mono">{report.review.course.code}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      report.review.status === 'APPROVED' ? 'bg-green-100 text-green-700'
                      : report.review.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      Review: {report.review.status}
                    </span>
                  </div>

                  <blockquote className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border-l-2 border-slate-200 line-clamp-3">
                    {report.review.body}
                  </blockquote>

                  {report.details && (
                    <p className="text-sm text-slate-500 mt-2">
                      <span className="font-medium">Reporter note:</span> {report.details}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <User className="h-3 w-3" /> Reported by {report.user.name ?? report.user.email}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(report.createdAt).toLocaleDateString('en-LB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link href={`/admin/reviews?reviewId=${report.reviewId}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50">
                    Review <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(total / perPage) > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-slate-500">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/reports?status=${status}&page=${page - 1}`}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                ← Previous
              </Link>
            )}
            {page < Math.ceil(total / perPage) && (
              <Link href={`/admin/reports?status=${status}&page=${page + 1}`}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
