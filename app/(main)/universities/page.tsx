import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import { Users, BookOpen, Star, ArrowRight, Zap, Clock } from 'lucide-react'
import { DataTierBadge } from '@/components/universities/DataTierBadge'
import { getCapability } from '@/lib/university-capabilities'


export const dynamic = 'force-dynamic'
const LOGO_EXT: Record<string, string> = {
  aub: 'png', lau: 'png', liu: 'png', bau: 'png',
  ua: 'png', aust: 'png', aou: 'png', ndu: 'jpg', usek: 'jpg',
}
function uniLogoPath(slug: string) {
  return `/logos/${slug}.${LOGO_EXT[slug] ?? 'svg'}`
}
export const metadata: Metadata = {
  title: 'Lebanese Universities – Professor Reviews & Course Ratings',
  description: 'Browse professor reviews and course ratings for all major Lebanese universities: AUB, LAU, USJ, LIU, NDU, BAU, AUST, and more.',
}

export default async function UniversitiesPage() {
  const universities = await prisma.university.findMany({
    where: { isActive: true },
    orderBy: { shortName: 'asc' },
    include: { _count: { select: { faculties: true } } },
  })

  const stats = await Promise.all(
    universities.map(async uni => {
      const [profCount, courseCount, reviewCount] = await Promise.all([
        prisma.professor.count({ where: { isActive: true, department: { faculty: { universityId: uni.id } } } }),
        prisma.course.count({ where: { isActive: true, department: { faculty: { universityId: uni.id } } } }),
        prisma.review.count({
          where: {
            status: 'APPROVED',
            OR: [
              { professor: { department: { faculty: { universityId: uni.id } } } },
              { course: { department: { faculty: { universityId: uni.id } } } },
            ],
          },
        }),
      ])
      return { id: uni.id, profCount, courseCount, reviewCount }
    })
  )

  const statsMap = Object.fromEntries(stats.map(s => [s.id, s]))

  const liveUniversities = universities.filter(u => ['aub', 'lau'].includes(u.slug))
  const otherUniversities = universities.filter(u => !['aub', 'lau'].includes(u.slug))

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
      {/* Page header */}
      <div className="mb-12">
        <p className="section-label mb-3">All schools</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Lebanese Universities
        </h1>
        <p className="text-slate-500 max-w-xl text-base">
          Browse professor reviews and course ratings at {universities.length} major Lebanese universities.
        </p>
      </div>

      {/* ── LIVE DATA UNIVERSITIES ─────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <Zap className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Live Data</span>
          </div>
          <p className="text-sm text-slate-500">Real-time section data synced every semester</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {liveUniversities.map(uni => {
            const s = statsMap[uni.id]
            return (
              <Link
                key={uni.id}
                href={`/universities/${uni.slug}`}
                className="es-card es-card-link group flex flex-col p-6 cursor-pointer border-green-100 hover:border-green-300"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow bg-white border border-slate-100 flex items-center justify-center">
                    <Image src={uniLogoPath(uni.slug)} alt={`${uni.shortName} logo`} width={64} height={64} className="w-full h-full object-contain p-1" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-slate-900 text-base group-hover:text-blue-700 transition-colors">
                        {uni.shortName}
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-green-500" />
                        Live Data
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 leading-tight mt-0.5 line-clamp-2">{uni.name}</p>
                    {uni.city && <p className="text-xs text-slate-400 mt-1">{uni.city}</p>}
                  </div>
                </div>
                <div className="mb-4">
                  <DataTierBadge capability={getCapability(uni.slug)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <StatChip icon={Users}    value={s?.profCount   ?? 0} label="Profs"   />
                  <StatChip icon={BookOpen} value={s?.courseCount ?? 0} label="Courses" />
                  <StatChip icon={Star}     value={s?.reviewCount ?? 0} label="Reviews" />
                </div>
                <div className="flex items-center justify-end mt-4 text-xs font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                  View school <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── MORE UNIVERSITIES ──────────────────────────────────────── */}
      {otherUniversities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">More Universities</span>
            </div>
            <p className="text-sm text-slate-500">Reviews and course data — live scheduling coming soon</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {otherUniversities.map(uni => {
              const s = statsMap[uni.id]
              return (
                <Link
                  key={uni.id}
                  href={`/universities/${uni.slug}`}
                  className="es-card es-card-link group flex flex-col p-6 cursor-pointer"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow bg-white border border-slate-100 flex items-center justify-center">
                      <Image src={uniLogoPath(uni.slug)} alt={`${uni.shortName} logo`} width={64} height={64} className="w-full h-full object-contain p-1" unoptimized />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-slate-900 text-base group-hover:text-blue-700 transition-colors">
                          {uni.shortName}
                        </h2>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-tight mt-0.5 line-clamp-2">{uni.name}</p>
                      {uni.city && <p className="text-xs text-slate-400 mt-1">{uni.city}</p>}
                    </div>
                  </div>
                  <div className="mb-4">
                    <DataTierBadge capability={getCapability(uni.slug)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-auto">
                    <StatChip icon={Users}    value={s?.profCount   ?? 0} label="Profs"   />
                    <StatChip icon={BookOpen} value={s?.courseCount ?? 0} label="Courses" />
                    <StatChip icon={Star}     value={s?.reviewCount ?? 0} label="Reviews" />
                  </div>
                  <div className="flex items-center justify-end mt-4 text-xs font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                    View school <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatChip({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-3 transition-colors group-hover:border-blue-100 group-hover:bg-blue-50/40">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="font-bold text-sm leading-none text-slate-800">{value.toLocaleString()}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}
