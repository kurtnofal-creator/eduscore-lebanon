import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { AdBanner } from '@/components/ads/AdBanner'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { ReviewForm } from '@/components/reviews/ReviewForm'
import { Star, Users, BookOpen, ThumbsUp, ChevronRight, ArrowUpRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { DataReportButton } from '@/components/DataReportButton'

interface Props { params: Promise<{ slug: string }> }


export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const course = await prisma.course.findFirst({
    where: { slug, isActive: true },
    include: { department: { include: { faculty: { include: { university: true } } } } },
  })
  if (!course) return { title: 'Course Not Found' }
  return {
    title: `${course.code} ${course.name} – Course Reviews`,
    description: `Student reviews and professor ratings for ${course.code} at ${course.department?.faculty?.university?.name ?? 'Lebanese university'}.`,
  }
}

function StatPill({ label, value, color }: { label: string; value: string | number | null | undefined; color: string }) {
  if (value == null) return null
  return (
    <div className={cn('flex flex-col items-center p-4 rounded-2xl border', color)}>
      <span className="text-2xl font-black leading-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {typeof value === 'number' ? value.toFixed(1) : value}
      </span>
      <span className="text-xs font-medium mt-1.5 opacity-75">{label}</span>
    </div>
  )
}

function ProfComparison({ professorCourse }: {
  professorCourse: {
    professor: {
      id: string; fullName: string; slug: string;
      overallRating: number | null; workloadLevel: number | null;
      gradingFairness: number | null; teachingClarity: number | null;
      reviewCount: number; recommendRate: number | null;
    }
  }
}) {
  const p = professorCourse.professor
  const rating = p.overallRating
  const badgeClass = rating == null ? 'rating-none' : rating >= 4 ? 'rating-great' : rating >= 3 ? 'rating-ok' : 'rating-poor'

  function Bar({ value, label }: { value: number | null | undefined; label: string }) {
    if (value == null) return null
    const pct = Math.min(100, (value / 5) * 100)
    const fill = value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-amber-400' : 'bg-red-400'
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-28 shrink-0 truncate">{label}</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', fill)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-slate-600 w-6 text-right tabular-nums">{value.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <div className="es-card es-card-link group p-5">
      <div className="flex items-start gap-4 mb-4">
        {/* Rating badge */}
        <div className={cn('rating-badge flex-shrink-0 flex flex-col items-center justify-center', badgeClass)}
          style={{ width: 56, height: 56, fontSize: 18 }}>
          {rating != null ? rating.toFixed(1) : 'N/A'}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <Link href={`/professors/${p.slug}`}
            className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-[15px] leading-tight flex items-start gap-1">
            {p.fullName}
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-400 transition-colors mt-0.5 flex-shrink-0" />
          </Link>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Users className="h-3 w-3" /> {p.reviewCount} reviews
            </span>
            {p.recommendRate != null && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                <ThumbsUp className="h-3 w-3" /> {Math.round(p.recommendRate)}% recommend
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rating bars */}
      <div className="space-y-2.5 border-t border-slate-100 pt-4">
        <Bar value={p.teachingClarity}  label="Teaching Clarity" />
        <Bar value={p.gradingFairness}  label="Grading Fairness" />
        <Bar value={p.workloadLevel}    label="Workload" />
      </div>
    </div>
  )
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params
  const [course, session] = await Promise.all([
    prisma.course.findFirst({
      where: { slug, isActive: true },
      include: {
        department: { include: { faculty: { include: { university: true } } } },
        professorCourses: {
          where: { isActive: true },
          include: {
            professor: {
              select: {
                id: true, fullName: true, slug: true,
                overallRating: true, workloadLevel: true, gradingFairness: true,
                teachingClarity: true, reviewCount: true, recommendRate: true,
              },
            },
          },
          orderBy: { professor: { overallRating: 'desc' } },
        },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
          take: 15,
          select: {
            id: true, body: true, pros: true, cons: true,
            overallRating: true, teachingClarity: true, workloadLevel: true,
            gradingFairness: true, attendanceStrict: true, examDifficulty: true,
            wouldRecommend: true, grade: true, termTaken: true,
            helpfulCount: true, createdAt: true,
          },
        },
      },
    }),
    auth(),
  ])
  if (!course) notFound()

  const uni = course.department?.faculty?.university
  const dept = course.department
  const hasReviewed = session?.user?.id
    ? await prisma.review.findFirst({ where: { userId: session.user.id, courseId: course.id } })
    : null

  const confirmedProfCount = await prisma.sectionProfessor.count({
    where: { section: { courseId: course.id }, confidence: 'CONFIRMED' },
  }).catch(() => 0)  // defensive: falls back to 0 (shows unconfirmed warning) if query fails

  trackEvent('page_view', { page: `/courses/${slug}`, entityId: course.id, entityType: 'course' }).catch(() => {})

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-1.5 text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-700 transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            {uni && <><Link href={`/universities/${uni.slug}`} className="hover:text-slate-700 transition-colors">{uni.shortName}</Link><ChevronRight className="h-3.5 w-3.5" /></>}
            <Link href="/courses" className="hover:text-slate-700 transition-colors">Courses</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-700 font-medium">{course.code}</span>
          </nav>
        </div>
      </div>

      {/* Course header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{course.code}</span>
                {uni && <span className="text-sm text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{uni.shortName}</span>}
                {course.credits && <span className="text-sm text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{course.credits} credits</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {course.name}
              </h1>
              {dept && <p className="text-slate-400 text-sm mt-1">{dept.name}</p>}
              {course.description && <p className="text-slate-500 text-sm mt-3 max-w-2xl leading-relaxed">{course.description}</p>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-xl">
            <StatPill label="Avg Grading"    value={course.avgGrading}    color="bg-blue-50 border-blue-100 text-blue-700" />
            <StatPill label="Avg Workload"   value={course.avgWorkload}   color="bg-orange-50 border-orange-100 text-orange-700" />
            <StatPill label="Avg Difficulty" value={course.avgDifficulty} color="bg-red-50 border-red-100 text-red-700" />
            <StatPill label="Reviews"        value={course.reviewCount}   color="bg-slate-50 border-slate-200 text-slate-700" />
          </div>
          <div className="mt-4">
            <DataReportButton
              universitySlug={uni?.slug ?? ''}
              courseCode={course.code}
              page={`/courses/${slug}`}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Professor comparison */}
          <div className="lg:col-span-2 space-y-6">
            {course.professorCourses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-slate-900">
                    Professor Comparison
                    <span className="ml-2 text-sm font-normal text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                      {course.professorCourses.length} teaching this course
                    </span>
                  </h2>
                </div>
                {confirmedProfCount === 0 && (
                  <div className="flex items-start gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 mb-4">
                    <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Professor assignments for this course are based on historical schedule data and have not been confirmed for the current term. Assignments may change.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {course.professorCourses.map(pc => (
                    <ProfComparison key={pc.professor.id} professorCourse={pc} />
                  ))}
                </div>
              </div>
            )}

            <AdBanner slot="course-page-middle" />

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-900">Course Reviews</h2>
                <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{course.reviewCount} total</span>
              </div>

              {course.reviews.length === 0 ? (
                <div className="es-card p-14 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Star className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500">No reviews yet for this course.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {course.reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="es-card p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Rate This Course</h3>
              {session?.user ? (
                hasReviewed ? (
                  <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">You&apos;ve already reviewed this course.</p>
                ) : (
                  <ReviewForm courseId={course.id} courseName={`${course.code} ${course.name}`} />
                )
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 mb-4">Sign in to write an anonymous review</p>
                  <Link href="/login" className="btn-primary text-sm w-full justify-center">Sign In to Review</Link>
                </div>
              )}
            </div>
            <AdBanner slot="course-sidebar" vertical />
          </div>
        </div>
      </div>
    </div>
  )
}
