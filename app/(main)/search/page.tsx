import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { ProfessorCard } from '@/components/professors/ProfessorCard'
import { CourseCard } from '@/components/courses/CourseCard'
import { SearchBar } from '@/components/search/SearchBar'
import { AdBanner } from '@/components/ads/AdBanner'
import { SearchFilters } from '@/components/search/SearchFilters'
import { paginate } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

interface Props {
  searchParams: Promise<{
    q?: string
    type?: string
    universityId?: string
    page?: string
  }>
}


export const dynamic = 'force-dynamic'
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  return {
    title: q ? `Search results for "${q}"` : 'Search Professors & Courses',
    description: q
      ? `Find professors and courses matching "${q}" at Lebanese universities.`
      : 'Search for professors, courses, and departments across Lebanese universities.',
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const type = params.type ?? 'all'
  const universityId = params.universityId
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const perPage = 12

  if (q.length >= 2) {
    trackEvent('search', { query: q, type, universityId: universityId ?? null }).catch(() => {})
  }

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, shortName: true, name: true },
    orderBy: { shortName: 'asc' },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let professors: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let courses: any[] = []
  let professorTotal = 0
  let courseTotal = 0

  if (q.length >= 2) {
    const where = {
      ...(universityId && { department: { faculty: { universityId } } }),
    }

    if (type === 'all' || type === 'professors') {
      const profWhere = {
        isActive: true,
        isMerged: false,
        fullName: { contains: q },
        ...where,
      }
      ;[professors, professorTotal] = await Promise.all([
        prisma.professor.findMany({
          where: profWhere,
          skip: type === 'professors' ? (page - 1) * perPage : 0,
          take: type === 'professors' ? perPage : 4,
          orderBy: { reviewCount: 'desc' },
          select: {
            id: true, fullName: true, slug: true, title: true, imageUrl: true,
            overallRating: true, workloadLevel: true, reviewCount: true, recommendRate: true,
            department: {
              select: {
                name: true,
                faculty: { select: { university: { select: { shortName: true, slug: true } } } },
              },
            },
          },
        }),
        prisma.professor.count({ where: profWhere }),
      ])
    }

    if (type === 'all' || type === 'courses') {
      const courseWhere = {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
        ],
        ...where,
      }
      ;[courses, courseTotal] = await Promise.all([
        prisma.course.findMany({
          where: courseWhere,
          skip: type === 'courses' ? (page - 1) * perPage : 0,
          take: type === 'courses' ? perPage : 4,
          orderBy: { reviewCount: 'desc' },
          select: {
            id: true, code: true, name: true, slug: true, credits: true,
            avgWorkload: true, avgDifficulty: true, reviewCount: true,
            department: {
              select: {
                name: true, code: true,
                faculty: { select: { university: { select: { shortName: true, slug: true } } } },
              },
            },
          },
        }),
        prisma.course.count({ where: courseWhere }),
      ])
    }
  }

  const totalResults = professorTotal + courseTotal

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="section-label mb-3">Search</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          {q ? `Results for "${q}"` : 'Search Professors & Courses'}
        </h1>
        <SearchBar
          defaultValue={q}
          placeholder="Search professors, courses, departments..."
          large
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <div className="lg:col-span-1">
          <SearchFilters
            universities={universities}
            currentType={type}
            currentUniversityId={universityId}
            query={q}
          />
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-8">
          {q.length < 2 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">Start typing to search for professors and courses.</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="es-card p-16 text-center">
              <p className="text-slate-700 font-semibold text-base mb-1">No results found for &quot;{q}&quot;</p>
              <p className="text-slate-400 text-sm">No results found for your search. Try a different term.</p>
            </div>
          ) : (
            <>
              {/* Professors */}
              {professors.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <p className="section-label mb-0.5">People</p>
                      <h2 className="font-bold text-slate-900 text-xl">
                        Professors
                        <span className="ml-2 text-sm text-slate-400 font-normal">
                          ({professorTotal} found)
                        </span>
                      </h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {professors.map(prof => (
                      <ProfessorCard key={prof.id} professor={prof} />
                    ))}
                  </div>
                </section>
              )}

              {/* Courses */}
              {courses.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <p className="section-label mb-0.5">Academics</p>
                      <h2 className="font-bold text-slate-900 text-xl">
                        Courses
                        <span className="ml-2 text-sm text-slate-400 font-normal">
                          ({courseTotal} found)
                        </span>
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {courses.map(course => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </div>
                </section>
              )}

              <AdBanner slot="search-results-bottom" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
