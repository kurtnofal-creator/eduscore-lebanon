import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SearchBar } from '@/components/search/SearchBar'
import { BookOpen, ArrowRight, Star, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Course Reviews – Lebanese Universities | EduScore Lebanon',
  description: 'Browse course reviews, difficulty ratings, and workload data for courses at AUB, LAU, USJ, LIU, NDU, and BAU.',
}

interface Props {
  searchParams: Promise<{ uni?: string; dept?: string; sort?: string; page?: string }>
}

export default async function CoursesPage({ searchParams }: Props) {
  const params = await searchParams
  const uniSlug = params.uni ?? ''
  const sort = params.sort ?? 'reviews'
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const perPage = 24

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, shortName: true, slug: true },
    orderBy: { shortName: 'asc' },
  })

  const selectedUni = uniSlug
    ? universities.find(u => u.slug === uniSlug)
    : null

  const where = {
    isActive: true,
    reviewCount: { gt: 0 },
    ...(selectedUni && { department: { faculty: { universityId: selectedUni.id } } }),
  }

  const orderBy =
    sort === 'difficulty' ? { avgDifficulty: 'desc' as const } :
    sort === 'workload' ? { avgWorkload: 'desc' as const } :
    { reviewCount: 'desc' as const }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, code: true, name: true, slug: true, credits: true,
        avgDifficulty: true, avgWorkload: true, avgGrading: true, reviewCount: true,
        department: {
          select: {
            name: true,
            faculty: { select: { university: { select: { shortName: true, slug: true } } } },
          },
        },
      },
    }),
    prisma.course.count({ where }),
  ])

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
      {/* Header */}
      <div className="mb-10">
        <p className="section-label mb-3">All courses</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Course Directory
        </h1>
        <p className="text-slate-500 max-w-xl text-base">
          {total.toLocaleString()} course{total !== 1 ? 's' : ''} with student reviews. See difficulty, workload, and grading fairness at a glance.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <SearchBar placeholder="Search courses by name or code…" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/courses"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !uniSlug ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600'
            }`}
          >
            All Schools
          </Link>
          {universities.map(u => (
            <Link
              key={u.id}
              href={`/courses?uni=${u.slug}${sort !== 'reviews' ? `&sort=${sort}` : ''}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                uniSlug === u.slug ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              {u.shortName}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          {[
            { value: 'reviews', label: 'Most Reviewed' },
            { value: 'difficulty', label: 'Hardest' },
            { value: 'workload', label: 'Most Workload' },
          ].map(({ value, label }) => (
            <Link
              key={value}
              href={`/courses?${uniSlug ? `uni=${uniSlug}&` : ''}sort=${value}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                sort === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {courses.map(course => {
            const uni = course.department?.faculty?.university
            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="es-card es-card-link group flex flex-col p-5 cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <BookOpen className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-blue-600 font-mono">{course.code}</span>
                      {uni && <span className="text-xs text-slate-400">{uni.shortName}</span>}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight mt-0.5 group-hover:text-blue-700 transition-colors line-clamp-2">
                      {course.name}
                    </h3>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <MiniStat label="Difficulty" value={course.avgDifficulty} />
                  <MiniStat label="Workload" value={course.avgWorkload} />
                  <MiniStat label="Grading" value={course.avgGrading} />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="h-3.5 w-3.5" />
                    <span>{course.reviewCount} review{course.reviewCount !== 1 ? 's' : ''}</span>
                  </div>
                  {course.credits && (
                    <span className="text-xs text-slate-400">{course.credits} cr</span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="es-card p-16 text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm">
            No courses with reviews yet{selectedUni ? ` at ${selectedUni.shortName}` : ''}.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/courses?${uniSlug ? `uni=${uniSlug}&` : ''}sort=${sort}&page=${page - 1}`}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-blue-200 hover:text-blue-600 transition-all"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/courses?${uniSlug ? `uni=${uniSlug}&` : ''}sort=${sort}&page=${page + 1}`}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-blue-200 hover:text-blue-600 transition-all"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | null }) {
  const color = value == null ? 'text-slate-400' :
    label === 'Grading' ? (value >= 4 ? 'text-green-600' : value >= 3 ? 'text-amber-600' : 'text-red-600') :
    (value <= 2 ? 'text-green-600' : value <= 3 ? 'text-amber-600' : 'text-red-600')

  return (
    <div className="flex flex-col items-center gap-0.5 bg-slate-50 rounded-lg py-2">
      <span className={`font-bold text-sm leading-none ${color}`}>
        {value != null ? value.toFixed(1) : '—'}
      </span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  )
}
