import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ProfessorCard } from '@/components/professors/ProfessorCard'
import { CourseCard } from '@/components/courses/CourseCard'
import { AdBanner } from '@/components/ads/AdBanner'
import { BookOpen, Users, GraduationCap, ExternalLink, Building2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { DataTierBadge } from '@/components/universities/DataTierBadge'
import { getCapability } from '@/lib/university-capabilities'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const university = await prisma.university.findUnique({ where: { slug } })
  if (!university) return { title: 'University Not Found' }
  return {
    title: `${university.name} (${university.shortName}) – Professor & Course Reviews`,
    description: `Browse professor reviews and course ratings at ${university.name}. Find the best professors and plan your schedule at ${university.shortName}.`,
  }
}

export default async function UniversityPage({ params }: Props) {
  const { slug } = await params

  const university = await prisma.university.findUnique({
    where: { slug, isActive: true },
    include: {
      faculties: {
        include: {
          departments: {
            include: {
              _count: { select: { courses: true, professors: true } },
            },
          },
        },
      },
    },
  })

  if (!university) notFound()

  const capability = getCapability(university.slug)

  trackEvent('page_view', { page: `/universities/${slug}`, entityType: 'university' }).catch(() => {})

  const [topProfessors, popularCourses, totalStats] = await Promise.all([
    prisma.professor.findMany({
      where: {
        isActive: true,
        isMerged: false,
        reviewCount: { gte: 1 },
        department: { faculty: { universityId: university.id } },
      },
      orderBy: { overallRating: 'desc' },
      take: 8,
      select: {
        id: true, fullName: true, slug: true, title: true, imageUrl: true,
        overallRating: true, workloadLevel: true, reviewCount: true, recommendRate: true,
        department: {
          select: { name: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } },
        },
      },
    }),
    prisma.course.findMany({
      where: {
        isActive: true,
        reviewCount: { gte: 1 },
        department: { faculty: { universityId: university.id } },
      },
      orderBy: { reviewCount: 'desc' },
      take: 8,
      select: {
        id: true, code: true, name: true, slug: true, credits: true,
        avgWorkload: true, avgDifficulty: true, reviewCount: true,
        department: {
          select: { name: true, code: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } },
        },
      },
    }),
    Promise.all([
      prisma.professor.count({ where: { isActive: true, department: { faculty: { universityId: university.id } } } }),
      prisma.course.count({ where: { isActive: true, department: { faculty: { universityId: university.id } } } }),
      prisma.review.count({
        where: {
          status: 'APPROVED',
          OR: [
            { professor: { department: { faculty: { universityId: university.id } } } },
            { course: { department: { faculty: { universityId: university.id } } } },
          ],
        },
      }),
    ]),
  ])

  const [profCount, courseCount, reviewCount] = totalStats

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/universities" className="hover:text-foreground">Universities</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{university.shortName}</span>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center text-3xl font-bold">
            {university.shortName.slice(0, 3)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{university.name}</h1>
              <DataTierBadge capability={capability} />
            </div>
            <p className="text-blue-100 mt-1">{university.city}, Lebanon</p>
            {university.description && (
              <p className="text-blue-200 text-sm mt-3 max-w-2xl">{university.description}</p>
            )}
            {university.website && (
              <a
                href={university.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-200 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Official Website
              </a>
            )}
          </div>
          <div className="hidden md:flex flex-col gap-3 text-center">
            <div>
              <div className="text-3xl font-bold">{profCount}</div>
              <div className="text-blue-200 text-xs">Professors</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{courseCount}</div>
              <div className="text-blue-200 text-xs">Courses</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{reviewCount}</div>
              <div className="text-blue-200 text-xs">Reviews</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Top professors */}
          {topProfessors.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Top-Rated Professors</h2>
                <Link href={`/professors?universityId=${university.id}`} className="text-sm text-blue-600 hover:underline">
                  View all →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topProfessors.map(prof => (
                  <ProfessorCard key={prof.id} professor={prof} />
                ))}
              </div>
            </section>
          )}

          <AdBanner slot="university-page-middle" />

          {/* Popular courses */}
          {popularCourses.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Popular Courses</h2>
                <Link href={`/courses?universityId=${university.id}`} className="text-sm text-blue-600 hover:underline">
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {popularCourses.map(course => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: Faculties */}
        <div className="space-y-5">
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Faculties & Departments
            </h3>
            <div className="space-y-4">
              {university.faculties.map(faculty => (
                <div key={faculty.id}>
                  <h4 className="text-sm font-medium mb-2">{faculty.name}</h4>
                  <div className="space-y-1 pl-3">
                    {faculty.departments.map(dept => (
                      <div key={dept.id} className="flex items-center justify-between text-sm">
                        <Link
                          href={`/professors?departmentId=${dept.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {dept.name}
                        </Link>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{dept._count.professors}p</span>
                          <span>{dept._count.courses}c</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Data source transparency card */}
          <div className={[
            'border rounded-xl p-4 text-sm',
            capability.liveDataSupported
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200',
          ].join(' ')}>
            <p className={[
              'font-semibold mb-1 text-xs uppercase tracking-wide',
              capability.liveDataSupported ? 'text-emerald-700' : 'text-slate-500',
            ].join(' ')}>
              {capability.liveDataSupported ? 'Live Official Data' : 'Historical Catalog Data'}
            </p>
            <p className="text-slate-600 text-xs leading-relaxed mb-2">
              {capability.sourceDescription}
            </p>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>
                <span className="font-medium">Professor names:</span>{' '}
                {capability.liveDataSupported ? 'Confirmed from official schedule' : 'Inferred — may not reflect current term'}
              </div>
              <div>
                <span className="font-medium">Seat data:</span>{' '}
                {capability.seatDataAvailable ? 'Available' : 'Not available'}
              </div>
            </div>
          </div>

          <AdBanner slot="university-sidebar" vertical />
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollegeOrUniversity',
            name: university.name,
            alternateName: university.shortName,
            address: { '@type': 'PostalAddress', addressCountry: 'LB', addressLocality: university.city },
            url: university.website,
          }),
        }}
      />
    </div>
  )
}
