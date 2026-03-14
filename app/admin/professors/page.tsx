import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Users, Star, BookOpen, Search, ChevronRight } from 'lucide-react'

interface Props {
  searchParams: Promise<{ q?: string; uni?: string; page?: string }>
}

export default async function AdminProfessorsPage({ searchParams }: Props) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const uniSlug = params.uni ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const perPage = 40

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, shortName: true, slug: true },
    orderBy: { shortName: 'asc' },
  })

  const selectedUni = universities.find(u => u.slug === uniSlug)

  const where = {
    isActive: true,
    isMerged: false,
    ...(q ? {
      OR: [
        { fullName: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { department: { name: { contains: q } } },
      ],
    } : {}),
    ...(selectedUni ? {
      department: { faculty: { universityId: selectedUni.id } },
    } : {}),
  }

  const [professors, total] = await Promise.all([
    prisma.professor.findMany({
      where,
      include: {
        department: {
          select: { name: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } },
        },
        _count: { select: { reviews: true, professorCourses: true } },
      },
      orderBy: [{ reviewCount: 'desc' }, { fullName: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.professor.count({ where }),
  ])

  const totalPages = Math.ceil(total / perPage)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Professors</h1>
          <p className="text-slate-500 text-sm mt-1">{total.toLocaleString()} professors total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
        <form className="flex-1 min-w-60 flex gap-2">
          <input type="hidden" name="uni" value={uniSlug} />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name or department…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Search</button>
          {q && <Link href={`/admin/professors?uni=${uniSlug}`} className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Clear</Link>}
        </form>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/professors" className={`px-3 py-2 text-sm rounded-lg border font-medium ${!uniSlug ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>All</Link>
          {universities.map(uni => (
            <Link key={uni.id} href={`/admin/professors?uni=${uni.slug}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-2 text-sm rounded-lg border font-medium ${uniSlug === uni.slug ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {uni.shortName}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Professor</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Department</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">University</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Rating</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Reviews</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Courses</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {professors.map(prof => {
              const uni = prof.department?.faculty?.university
              const rating = prof.overallRating
              return (
                <tr key={prof.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-semibold text-slate-900">
                        {prof.title && <span className="text-slate-400 font-normal text-xs">{prof.title} </span>}
                        {prof.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell truncate max-w-[180px]">
                    {prof.department?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {uni ? (
                      <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{uni.shortName}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rating != null ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${rating >= 4 ? 'bg-green-100 text-green-700' : rating >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        <Star className="h-3 w-3 fill-current" /> {rating.toFixed(1)}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1 text-slate-600">
                      <Users className="h-3.5 w-3.5 text-slate-400" /> {prof.reviewCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="flex items-center justify-center gap-1 text-slate-600">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400" /> {prof._count.professorCourses}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/professors/${prof.slug}`} target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {professors.length === 0 && (
          <div className="py-16 text-center text-slate-400">No professors found.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/professors?page=${page - 1}${q ? `&q=${q}` : ''}${uniSlug ? `&uni=${uniSlug}` : ''}`}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/professors?page=${page + 1}${q ? `&q=${q}` : ''}${uniSlug ? `&uni=${uniSlug}` : ''}`}
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
