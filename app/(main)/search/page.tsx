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
        <h1 className="text-2xl font-bold mb-4">
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
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">No results found for &quot;{q}&quot;</p>
              <p className="text-sm mt-2">Try different keywords or browse by university.</p>
            </div>
          ) : (
            <>
              {/* Professors */}
              {professors.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg">
                      Professors
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({professorTotal} found)
                      </span>
                    </h2>
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg">
                      Courses
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({courseTotal} found)
                      </span>
                    </h2>
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
