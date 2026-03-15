import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Star, BookOpen, Calendar, User, ChevronRight, Clock, BookMarked, Heart, ArrowRight } from 'lucide-react'
import { WatchButton } from '@/components/professors/WatchButton'


export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'My Dashboard – EduScore Lebanon',
  description: 'Your saved professors, courses, schedules, and review history.',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [watchlist, savedSchedules, myReviews] = await Promise.all([
    prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      include: {
        professor: {
          select: {
            id: true, fullName: true, slug: true, title: true,
            overallRating: true, reviewCount: true,
            department: { select: { name: true, faculty: { select: { university: { select: { shortName: true } } } } } },
          },
        },
        course: {
          select: {
            id: true, code: true, name: true, slug: true,
            reviewCount: true, avgWorkload: true,
            department: { select: { name: true, faculty: { select: { university: { select: { shortName: true } } } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.savedSchedule.findMany({
      where: { userId: session.user.id },
      include: {
        sections: {
          include: {
            section: {
              include: {
                course: { select: { code: true, name: true } },
                professors: { include: { professor: { select: { fullName: true } } } },
                meetings: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.review.findMany({
      where: { userId: session.user.id },
      include: {
        professor: { select: { fullName: true, slug: true } },
        course: { select: { code: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const favProfessors = watchlist.filter(w => w.type === 'PROFESSOR')
  const favCourses = watchlist.filter(w => w.type === 'COURSE')

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
              {session.user.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {session.user.name ?? 'My Dashboard'}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">{session.user.email}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-6 mt-6">
            {[
              { icon: Heart, label: 'Saved professors', count: favProfessors.length, color: 'text-red-500' },
              { icon: BookOpen, label: 'Saved courses', count: favCourses.length, color: 'text-blue-500' },
              { icon: Calendar, label: 'Saved schedules', count: savedSchedules.length, color: 'text-green-500' },
              { icon: Star, label: 'Reviews submitted', count: myReviews.length, color: 'text-amber-500' },
            ].map(({ icon: Icon, label, count, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="font-bold text-slate-900">{count}</span>
                <span className="text-slate-400 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Saved Professors ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" /> Saved Professors
              <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{favProfessors.length}</span>
            </h2>
            <Link href="/professors" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {favProfessors.length === 0 ? (
            <EmptyState icon={User} message="No saved professors yet." linkHref="/professors" linkLabel="Browse professors" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favProfessors.map(w => {
                const p = w.professor!
                const rating = p.overallRating
                const badgeClass = rating == null ? 'bg-slate-100 text-slate-400' : rating >= 4 ? 'bg-green-500 text-white' : rating >= 3 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white'
                const uni = p.department?.faculty?.university
                return (
                  <div key={w.id} className="es-card p-4 flex items-start gap-3 group">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${badgeClass}`}>
                      {rating != null ? rating.toFixed(1) : 'N/A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/professors/${p.slug}`}
                        className="font-semibold text-slate-900 hover:text-blue-700 text-sm leading-tight block truncate">
                        {p.title && <span className="text-slate-400 font-normal">{p.title} </span>}{p.fullName}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {p.department?.name}{uni && ` · ${uni.shortName}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{p.reviewCount} reviews</p>
                    </div>
                    <WatchButton professorId={p.id} className="flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Saved Courses ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" /> Saved Courses
              <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{favCourses.length}</span>
            </h2>
            <Link href="/courses" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {favCourses.length === 0 ? (
            <EmptyState icon={BookOpen} message="No saved courses yet." linkHref="/courses" linkLabel="Browse courses" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favCourses.map(w => {
                const c = w.course!
                const uni = c.department?.faculty?.university
                return (
                  <div key={w.id} className="es-card p-4 flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/courses/${c.slug}`}
                        className="font-semibold text-slate-900 hover:text-blue-700 text-sm leading-tight block">
                        <span className="font-mono text-blue-600">{c.code}</span> {c.name}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {c.department?.name}{uni && ` · ${uni.shortName}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{c.reviewCount} reviews</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Saved Schedules ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" /> Saved Schedules
              <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{savedSchedules.length}</span>
            </h2>
            <Link href="/schedule-builder" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Build new <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {savedSchedules.length === 0 ? (
            <EmptyState icon={Calendar} message="No saved schedules yet." linkHref="/schedule-builder" linkLabel="Build a schedule" />
          ) : (
            <div className="space-y-3">
              {savedSchedules.map(schedule => (
                <div key={schedule.id} className="es-card p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{schedule.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {schedule.sections.length} course{schedule.sections.length !== 1 ? 's' : ''} ·{' '}
                        Saved {new Date(schedule.createdAt).toLocaleDateString('en-LB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <BookMarked className="h-4 w-4 text-slate-300 flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {schedule.sections.map(ss => (
                      <div key={ss.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-mono text-xs font-bold text-blue-600">{ss.section.course.code}</span>
                        <span className="text-xs text-slate-500 hidden sm:block">{ss.section.course.name}</span>
                        {ss.section.meetings[0] && (
                          <span className="text-xs text-slate-400">
                            · {ss.section.meetings[0].day?.slice(0,3)} {ss.section.meetings[0].startTime}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── My Reviews ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" /> My Reviews
              <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{myReviews.length}</span>
            </h2>
          </div>

          {myReviews.length === 0 ? (
            <EmptyState icon={Star} message="You haven't submitted any reviews yet." linkHref="/professors" linkLabel="Find a professor to review" />
          ) : (
            <div className="space-y-3">
              {myReviews.map(review => (
                <div key={review.id} className="es-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {review.professor && (
                          <Link href={`/professors/${review.professor.slug}`}
                            className="text-sm font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1">
                            <User className="h-3.5 w-3.5" /> {review.professor.fullName}
                          </Link>
                        )}
                        {review.course && (
                          <Link href={`/courses/${review.course.slug}`}
                            className="text-sm font-semibold text-slate-700 hover:text-blue-700 flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span className="font-mono text-blue-600">{review.course.code}</span> {review.course.name}
                          </Link>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          review.status === 'APPROVED' ? 'bg-green-100 text-green-700'
                          : review.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
                          : review.status === 'FLAGGED' ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                          {review.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{review.body}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {review.overallRating != null && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-bold text-slate-700">{review.overallRating}/5</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3">
                    <Clock className="h-3 w-3 text-slate-300" />
                    <span className="text-xs text-slate-400">
                      {new Date(review.createdAt).toLocaleDateString('en-LB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {review.termTaken && <span className="text-xs text-slate-400">· {review.termTaken}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, message, linkHref, linkLabel }: {
  icon: React.ElementType
  message: string
  linkHref: string
  linkLabel: string
}) {
  return (
    <div className="es-card p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-7 w-7 text-slate-300" />
      </div>
      <p className="text-slate-500 text-sm mb-3">{message}</p>
      <Link href={linkHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800">
        {linkLabel} <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
