import Link from 'next/link'
import { Users, ThumbsUp, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getAvatarColor(name: string) {
  const first = name.trim()[0]?.toUpperCase() ?? 'A'
  if (first >= 'A' && first <= 'E') return 'bg-blue-100 text-blue-700'
  if (first >= 'F' && first <= 'J') return 'bg-violet-100 text-violet-700'
  if (first >= 'K' && first <= 'O') return 'bg-emerald-100 text-emerald-700'
  if (first >= 'P' && first <= 'T') return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

interface ProfessorCardProps {
  professor: {
    id: string
    fullName: string
    slug: string
    title?: string | null
    overallRating?: number | null
    workloadLevel?: number | null
    reviewCount: number
    recommendRate?: number | null
    department?: {
      name: string
      faculty?: { university?: { shortName: string; slug: string } | null } | null
    } | null
  }
}

function workloadBarClass(w: number) {
  if (w <= 2) return 'rating-bar-fill-great'
  if (w <= 3) return 'rating-bar-fill-ok'
  return 'rating-bar-fill-poor'
}

export function ProfessorCard({ professor }: ProfessorCardProps) {
  const uni = professor.department?.faculty?.university

  return (
    <Link
      href={`/professors/${professor.slug}`}
      className="es-card es-card-link group flex flex-col cursor-pointer hover-lift"
      style={{ padding: '20px' }}
    >
      {/* Avatar + name row */}
      <div className="flex items-start gap-3 mb-4">
        {/* Initials avatar */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0', getAvatarColor(professor.fullName))}>
          {getInitials(professor.fullName)}
        </div>

        {/* Name + dept + rating */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold text-slate-900 text-[15px] leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
            {professor.fullName}
          </h3>
          {professor.department && (
            <p className="text-xs text-slate-400 mt-1 truncate">
              {professor.department.name}
              {uni && <span className="text-blue-500 font-medium"> · {uni.shortName}</span>}
            </p>
          )}
          <div className="mt-1.5">
            {professor.overallRating != null && professor.overallRating > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700">
                ⭐ {professor.overallRating.toFixed(1)}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 italic">No reviews yet — be the first</span>
            )}
          </div>
        </div>
      </div>

      {/* Workload bar */}
      {professor.workloadLevel != null && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Workload</span>
            <span className="font-medium text-slate-500">{professor.workloadLevel.toFixed(1)}/5</span>
          </div>
          <div className="rating-bar-track overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', workloadBarClass(professor.workloadLevel))}
              style={{ width: `${(professor.workloadLevel / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" />
          <span>{professor.reviewCount} {professor.reviewCount === 1 ? 'review' : 'reviews'}</span>
        </div>
        <div className="flex items-center gap-3">
          {professor.recommendRate != null && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <ThumbsUp className="h-3 w-3" />
              {Math.round(professor.recommendRate)}%
            </span>
          )}
          <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
