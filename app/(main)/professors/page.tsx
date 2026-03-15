import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ProfessorCard } from '@/components/professors/ProfessorCard'
import { SearchBar } from '@/components/search/SearchBar'
import { Users, Star, BookOpen } from 'lucide-react'


export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Professor Reviews – Lebanese Universities | EduScore Lebanon',
  description: 'Browse professor reviews and ratings at AUB, LAU, USJ, LIU, NDU, BAU and other Lebanese universities.',
}

interface Props {
  searchParams: Promise<{ uni?: string; sort?: string; page?: string }>
}

export default async function ProfessorsPage({ searchParams }: Props) {
  const params = await searchParams
  const uniSlug = params.uni ?? ''
  const sort = params.sort ?? 'rating'
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
    isMerged: false,
    reviewCount: { gt: 0 },
    ...(selectedUni && { department: { faculty: { universityId: selectedUni.id } } }),
  }

  const orderBy =
    sort === 'reviews' ? { reviewCount: 'desc' as const } :
    sort === 'recommend' ? { recommendRate: 'desc' as const } :
    { overallRating: 'desc' as const }

  const [professors, total] = await Promise.all([
    prisma.professor.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, fullName: true, slug: true, title: true,
        overallRating: true, workloadLevel: true, reviewCount: true, recommendRate: true,
        department: { select: { name: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } } },
      },
    }),
    prisma.professor.count({ where }),
  ])

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
      {/* Header */}
      <div className="mb-10">
        <p className="section-label mb-3">All faculty</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Professor Reviews
        </h1>
        <p className="text-slate-500 max-w-xl text-base">
          {total.toLocaleString()} professor{total !== 1 ? 's' : ''} with student reviews across Lebanese universities.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <SearchBar placeholder="Search professors…" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-8">
        {/* University filter */}
        <div className="flex flex-wrap gap-2 flex-1">
          <Link
            href="/professors"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !uniSlug ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600'
            }`}
          >
            All Schools
          </Link>
          {universities.map(u => (
            <Link
              key={u.id}
              href={`/professors?uni=${u.slug}${sort !== 'rating' ? `&sort=${sort}` : ''}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                uniSlug === u.slug ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              {u.shortName}
            </Link>
          ))}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {[
            { value: 'rating', label: 'Top Rated', icon: Star },
            { value: 'reviews', label: 'Most Reviewed', icon: Users },
            { value: 'recommend', label: 'Recommended', icon: BookOpen },
          ].map(({ value, label, icon: Icon }) => (
            <Link
              key={value}
              href={`/professors?${uniSlug ? `uni=${uniSlug}&` : ''}sort=${value}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                sort === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {professors.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          {professors.map(prof => (
            <ProfessorCard key={prof.id} professor={prof} />
          ))}
        </div>
      ) : (
        <div className="es-card p-16 text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm">
            No professors with reviews yet{selectedUni ? ` at ${selectedUni.shortName}` : ''}.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/professors?${uniSlug ? `uni=${uniSlug}&` : ''}sort=${sort}&page=${page - 1}`}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-blue-200 hover:text-blue-600 transition-all"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/professors?${uniSlug ? `uni=${uniSlug}&` : ''}sort=${sort}&page=${page + 1}`}
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
