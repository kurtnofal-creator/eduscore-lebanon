import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { ReviewForm } from '@/components/reviews/ReviewForm'
import { AdBanner } from '@/components/ads/AdBanner'
import { WatchButton } from '@/components/professors/WatchButton'
import { auth } from '@/lib/auth'
import { Star, Users, BookOpen, ThumbsUp, ChevronRight, Award, TrendingDown, TrendingUp, Clock, PenLine, Shield, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { DataReportButton } from '@/components/DataReportButton'

interface Props { params: Promise<{ slug: string }> }


export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const professor = await prisma.professor.findFirst({
    where: { slug, isActive: true },
    include: { department: { include: { faculty: { include: { university: true } } } } },
  })
  if (!professor) return { title: 'Professor Not Found' }
  const uni = professor.department?.faculty?.university
  const rating = professor.overallRating ? `${professor.overallRating.toFixed(1)}/5` : 'unrated'
  return {
    title: `${professor.fullName} Reviews – ${uni?.shortName ?? 'Lebanese University'}`,
    description: `${professor.reviewCount} student reviews for ${professor.fullName} at ${uni?.name}. Rating: ${rating}.`,
  }
}

function RatingBadgeLarge({ value }: { value: number | null | undefined }) {
  if (value == null) return (
    <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center">
      <span className="text-2xl font-bold text-slate-300">N/A</span>
      <span className="text-[10px] text-slate-400 mt-0.5">No ratings</span>
    </div>
  )
  const cls = value >= 4 ? ['bg-green-500','border-green-400'] : value >= 3 ? ['bg-amber-400','border-amber-300'] : ['bg-red-500','border-red-400']
  const label = value >= 4.5 ? 'Awesome' : value >= 4 ? 'Good' : value >= 3 ? 'Average' : 'Poor'
  return (
    <div className={cn('w-24 h-24 rounded-2xl flex flex-col items-center justify-center border', cls[0], cls[1])}>
      <span className="text-3xl font-black text-white leading-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{value.toFixed(1)}</span>
      <span className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function RatingRow({ label, value, max = 5 }: { label: string; value: number | null | undefined; max?: number }) {
  if (value == null) return null
  const pct = Math.min(100, (value / max) * 100)
  const fillClass = value >= 4 ? 'rating-bar-fill-great' : value >= 3 ? 'rating-bar-fill-ok' : 'rating-bar-fill-poor'
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500 w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 rating-bar-track rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', fillClass)} style={{ width: `${pct}%`, height: 8 }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-7 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}

const TAGS: Record<string, string[]> = {
  great: ['Clear Explanations', 'Helpful Outside Class', 'Inspirational', 'Fair Grader', 'Accessible'],
  ok:    ['Participation Matters', 'Group Projects', 'Skip Class? You\'ll Regret It'],
  hard:  ['Heavy Workload', 'Lots of Homework', 'Tough Grader', 'Test Heavy', 'Lecture Heavy'],
}

function autoTags(prof: { overallRating?: number | null; workloadLevel?: number | null; gradingFairness?: number | null }) {
  const tags: string[] = []
  if ((prof.overallRating ?? 0) >= 4) tags.push(...TAGS.great.slice(0, 2))
  if ((prof.workloadLevel ?? 0) >= 4) tags.push(TAGS.hard[0], TAGS.hard[1])
  if ((prof.gradingFairness ?? 5) <= 2.5) tags.push(TAGS.hard[2])
  if ((prof.gradingFairness ?? 0) >= 4) tags.push('Fair Grader')
  return tags.slice(0, 5)
}

// ── Insight extraction from review pros/cons text (Part 10) ─────────────────

const STRENGTH_KEYWORDS = [
  ['clear', 'explains', 'explanation', 'clarity'],
  ['helpful', 'available', 'office hours', 'accessible'],
  ['fair', 'grading', 'grades fairly'],
  ['engaging', 'interesting', 'passionate', 'inspiring'],
  ['organized', 'structured', 'prepared'],
  ['knowledgeable', 'expert', 'expertise'],
  ['kind', 'friendly', 'approachable', 'nice'],
]
const STRENGTH_LABELS = [
  'Clear explanations', 'Very accessible', 'Fair grader',
  'Engaging lectures', 'Well-organized', 'Deep expertise', 'Approachable',
]
const WEAKNESS_KEYWORDS = [
  ['hard exam', 'difficult exam', 'tough exam', 'exam heavy'],
  ['heavy workload', 'lots of homework', 'too much work'],
  ['attendance', 'strict attendance', 'mandatory attendance'],
  ['boring', 'monotone', 'unengaging', 'dull'],
  ['unclear', 'confusing', 'hard to follow'],
  ['unfair', 'harsh grading', 'tough grader'],
]
const WEAKNESS_LABELS = [
  'Difficult exams', 'Heavy workload', 'Strict attendance',
  'Dry delivery', 'Sometimes unclear', 'Tough grader',
]
function buildStudentSummary(
  prof: {
    overallRating?: number | null
    recommendRate?: number | null
    workloadLevel?: number | null
    examDifficulty?: number | null
    reviewCount: number
  },
  insights: { strengths: string[]; weaknesses: string[] }
): string[] {
  const bullets: string[] = []
  if ((prof.recommendRate ?? 0) >= 80) {
    bullets.push(`${Math.round(prof.recommendRate!)}% of students would take this professor again`)
  } else if ((prof.recommendRate ?? 100) < 50 && prof.reviewCount >= 5) {
    bullets.push(`Mixed reception — under half of reviewers would recommend`)
  }
  bullets.push(...insights.strengths.slice(0, 2))
  if ((prof.workloadLevel ?? 0) >= 4) bullets.push('Expect a heavy workload — plan your schedule accordingly')
  else if ((prof.workloadLevel ?? 0) > 0 && (prof.workloadLevel ?? 0) <= 2) bullets.push('Light workload — good for balancing with heavier courses')
  if ((prof.examDifficulty ?? 0) >= 4) bullets.push('Exams are challenging — past papers and office hours help a lot')
  bullets.push(...insights.weaknesses.slice(0, 1))
  return bullets.slice(0, 5)
}

function extractInsights(reviews: Array<{ pros?: string | null; cons?: string | null }>) {
  const allPros = reviews.map(r => (r.pros ?? '').toLowerCase()).join(' ')
  const allCons = reviews.map(r => (r.cons ?? '').toLowerCase()).join(' ')
  const strengths = STRENGTH_KEYWORDS
    .map((kws, i) => kws.some(kw => allPros.includes(kw)) ? STRENGTH_LABELS[i] : null)
    .filter((s): s is string => s !== null)
    .slice(0, 4)
  const weaknesses = WEAKNESS_KEYWORDS
    .map((kws, i) => kws.some(kw => allCons.includes(kw)) ? WEAKNESS_LABELS[i] : null)
    .filter((s): s is string => s !== null)
    .slice(0, 3)
  return { strengths, weaknesses }
}

export default async function ProfessorPage({ params }: Props) {
  const { slug } = await params
  const [professor, session] = await Promise.all([
    prisma.professor.findFirst({
      where: { slug, isActive: true },
      include: {
        department: { include: { faculty: { include: { university: true } } } },
        professorCourses: { where: { isActive: true }, include: { course: { select: { id: true, code: true, name: true, slug: true } } }, take: 12 },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
          take: 20,
          select: {
            id: true, body: true, pros: true, cons: true, tags: true,
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
  if (!professor) notFound()

  const uni = professor.department?.faculty?.university
  const dept = professor.department
  const tags = autoTags(professor)
  const insights = extractInsights(professor.reviews)
  const studentSummary = buildStudentSummary(professor, insights)

  // Compute top tags from reviews
  const tagCounts: Record<string, number> = {}
  for (const review of professor.reviews) {
    if (review.tags) {
      try {
        const parsed: string[] = JSON.parse(review.tags)
        for (const t of parsed) {
          tagCounts[t] = (tagCounts[t] ?? 0) + 1
        }
      } catch { /* ignore malformed */ }
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)

  const hasUserReviewed = session?.user?.id
    ? await prisma.review.findFirst({ where: { userId: session.user.id, professorId: professor.id } })
    : null
  const currentSections = await prisma.section.findMany({
    where: { professors: { some: { professorId: professor.id } }, term: { isCurrent: true }, isActive: true },
    include: { course: { select: { code: true, name: true } }, meetings: true, term: { select: { name: true } } },
    take: 6,
  })

  trackEvent('page_view', { page: `/professors/${slug}`, entityId: professor.id, entityType: 'professor' }).catch(() => {})

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-1.5 text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-700 transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            {uni && <><Link href={`/universities/${uni.slug}`} className="hover:text-slate-700 transition-colors">{uni.shortName}</Link><ChevronRight className="h-3.5 w-3.5" /></>}
            <span className="text-slate-700 font-medium truncate">{professor.fullName}</span>
          </nav>
        </div>
      </div>

      {/* ── Profile header ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">

            {/* Rating badge */}
            <RatingBadgeLarge value={professor.overallRating} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {professor.title && <span className="text-slate-400 font-normal">{professor.title} </span>}
                    {professor.fullName}
                  </h1>
                  <p className="text-slate-500 mt-1">
                    {dept?.name}
                    {uni && <> · <Link href={`/universities/${uni.slug}`} className="text-blue-600 hover:underline font-medium">{uni.shortName}</Link></>}
                  </p>
                </div>
                <WatchButton professorId={professor.id} />
              </div>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-slate-700">{professor.reviewCount}</span>
                  <span className="text-slate-400">reviews</span>
                </div>
                {professor.recommendRate != null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-green-700">{Math.round(professor.recommendRate)}%</span>
                    <span className="text-slate-400">would recommend</span>
                  </div>
                )}
                {professor.workloadLevel != null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    {professor.workloadLevel >= 4 ? <TrendingUp className="h-4 w-4 text-red-400" /> : <TrendingDown className="h-4 w-4 text-green-400" />}
                    <span className="font-semibold text-slate-700">{professor.workloadLevel.toFixed(1)}</span>
                    <span className="text-slate-400">workload</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {tags.map(tag => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
              )}

              {/* Key insights (Part 10) — only show when there's enough review data */}
              {professor.reviewCount >= 3 && (insights.strengths.length > 0 || insights.weaknesses.length > 0) && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {insights.strengths.length > 0 && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3.5">
                      <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide mb-2">Students often mention</p>
                      <ul className="space-y-1">
                        {insights.strengths.map(s => (
                          <li key={s} className="flex items-center gap-1.5 text-sm text-green-800">
                            <span className="text-green-500 flex-shrink-0">✓</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insights.weaknesses.length > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                      <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-2">Things to note</p>
                      <ul className="space-y-1">
                        {insights.weaknesses.map(w => (
                          <li key={w} className="flex items-center gap-1.5 text-sm text-amber-800">
                            <span className="text-amber-500 flex-shrink-0">!</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4">
                <DataReportButton
                  universitySlug={uni?.slug ?? ''}
                  professorSlug={professor.slug}
                  page={`/professors/${slug}`}
                />
              </div>
            </div>
          </div>

          {/* Rating breakdown */}
          {professor.overallRating != null && (
            <div className="mt-8 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              {[
                { label: 'Teaching Clarity',        value: professor.teachingClarity },
                { label: 'Grading Fairness',        value: professor.gradingFairness },
                { label: 'Workload Level',           value: professor.workloadLevel },
                { label: 'Attendance Strictness',    value: professor.attendanceStrict },
                { label: 'Exam Difficulty',          value: professor.examDifficulty },
                { label: 'Participation Importance', value: professor.participation },
              ].filter(r => r.value != null).map(r => (
                <RatingRow key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Reviews ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {currentSections.length > 0 && (
              <div className="es-card p-5">
                <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" /> Current Term Sections
                </h2>
                <div className="space-y-2">
                  {currentSections.map(sec => (
                    <div key={sec.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{sec.course.code} — {sec.course.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{sec.term.name}</p>
                      </div>
                      <div className="text-right text-xs text-slate-400 shrink-0">
                        {sec.meetings.slice(0,1).map(m => (
                          <span key={m.id}>{m.day?.slice(0,3)} {m.startTime}–{m.endTime}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AdBanner slot="professor-page-middle" />

            {/* Write a review CTA for logged-out users */}
            {!session?.user && (
              <div className="es-card p-5 flex items-center gap-4 bg-blue-50 border-blue-100">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <PenLine className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">Have you taken a class with {professor.fullName.split(' ')[0]}?</p>
                  <p className="text-xs text-slate-500 mt-0.5">Share an anonymous review to help your fellow students.</p>
                </div>
                <Link href="/login" className="btn-primary text-sm flex-shrink-0">Write a Review</Link>
              </div>
            )}

            {/* Reviews */}
            <div>
              {/* What Students Say — AI summary */}
              {professor.reviewCount >= 5 && studentSummary.length > 0 ? (
                <div className="es-card p-5 mb-4 border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
                  <h3 className="font-semibold text-slate-900 mb-3.5 flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-3.5 w-3.5 text-white" />
                    </div>
                    What Students Say
                  </h3>
                  <ul className="space-y-2.5">
                    {studentSummary.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-400 mt-3.5 pt-3 border-t border-slate-100">
                    Generated from {professor.reviewCount} student reviews · Reviews are anonymous
                  </p>
                </div>
              ) : professor.reviewCount > 0 && professor.reviewCount < 5 ? (
                <div className="es-card p-4 mb-4 bg-slate-50 border-slate-200">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <p className="text-xs">Not enough reviews yet to generate a summary. Be the first to share your experience.</p>
                  </div>
                </div>
              ) : null}

              {topTags.length > 0 && (
                <div className="es-card p-4 mb-4">
                  <p className="section-label mb-2.5">Students often mention</p>
                  <div className="flex flex-wrap gap-2">
                    {topTags.map(tag => (
                      <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-slate-900">Student Reviews</h2>
                <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{professor.reviewCount} total</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Shield className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>Reviews are always anonymous. Student identities are never shared.</span>
              </div>
              <p className="text-xs text-slate-400 mb-4 flex items-center gap-1"><Shield className="h-3 w-3" /> Reviews reflect individual student experiences and are moderated before publishing.</p>

              {professor.reviews.length === 0 ? (
                <div className="es-card p-14 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Star className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium mb-1">No reviews yet — be the first to share your experience with this professor.</p>
                  <Link href="/login" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm hover:shadow-md">
                    <PenLine className="h-4 w-4" /> Write First Review
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {professor.reviews.map(review => <ReviewCard key={review.id} review={review} />)}
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Write a review */}
            <div className="es-card p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-500" /> Share Your Experience
              </h3>
              {session?.user ? (
                hasUserReviewed ? (
                  <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">
                    You&apos;ve already reviewed this professor. Thank you!
                  </p>
                ) : (
                  <ReviewForm professorId={professor.id} professorName={professor.fullName} />
                )
              ) : (
                <div className="text-center py-3">
                  <p className="text-sm text-slate-500 mb-4">Sign in to write an anonymous review</p>
                  <Link href="/login" className="btn-primary text-sm w-full justify-center">
                    Sign In to Review
                  </Link>
                </div>
              )}
            </div>

            {/* Courses taught */}
            {professor.professorCourses.length > 0 && (
              <div className="es-card p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" /> Courses Taught
                </h3>
                <div className="space-y-1.5">
                  {professor.professorCourses.map(pc => (
                    <Link key={pc.course.id} href={`/courses/${pc.course.slug}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-blue-50 transition-colors group">
                      <span className="font-mono text-xs text-blue-600 font-semibold w-20 shrink-0">{pc.course.code}</span>
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 truncate">{pc.course.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <AdBanner slot="professor-sidebar" vertical />
          </div>
        </div>
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Person',
          name: professor.fullName, jobTitle: 'Professor',
          worksFor: uni ? { '@type': 'CollegeOrUniversity', name: uni.name } : undefined,
          aggregateRating: professor.overallRating ? {
            '@type': 'AggregateRating', ratingValue: professor.overallRating.toFixed(1),
            reviewCount: professor.reviewCount, bestRating: 5, worstRating: 1,
          } : undefined,
        }),
      }} />
    </div>
  )
}
