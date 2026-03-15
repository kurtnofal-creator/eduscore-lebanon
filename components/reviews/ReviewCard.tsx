'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ThumbsUp, Flag, CheckCircle, XCircle } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

interface ReviewCardProps {
  review: {
    id: string
    body: string
    pros?: string | null
    cons?: string | null
    overallRating?: number | null
    teachingClarity?: number | null
    workloadLevel?: number | null
    gradingFairness?: number | null
    attendanceStrict?: number | null
    examDifficulty?: number | null
    wouldRecommend?: boolean | null
    grade?: string | null
    termTaken?: string | null
    tags?: string | string[] | null
    helpfulCount: number
    createdAt: Date | string
    professor?: { id: string; fullName: string; slug: string } | null
  }
  showProfessor?: boolean
}

function MiniRating({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return null
  const color = value >= 4 ? 'text-green-700 bg-green-50 border-green-100' : value >= 3 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-red-700 bg-red-50 border-red-100'
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border', color)}>
      {value.toFixed(1)} <span className="font-normal opacity-70">{label}</span>
    </span>
  )
}

export function ReviewCard({ review, showProfessor = false }: ReviewCardProps) {
  const [helpful, setHelpful] = useState(false)
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount)
  const [reported, setReported] = useState(false)

  const markHelpful = async () => {
    if (helpful) return
    setHelpful(true)
    setHelpfulCount(c => c + 1)
    await fetch('/api/reviews/helpful', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId: review.id }),
    }).catch(() => {})
  }

  const report = async () => {
    if (reported) return
    setReported(true)
    await fetch('/api/reviews/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId: review.id, reason: 'OTHER' }),
    }).catch(() => {})
  }

  const ratingColor = (review.overallRating ?? 0) >= 4 ? 'bg-green-500 border-green-400' : (review.overallRating ?? 0) >= 3 ? 'bg-amber-400 border-amber-300' : 'bg-red-500 border-red-400'

  return (
    <div className="es-card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        {/* Rating badge */}
        {review.overallRating != null && (
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border text-white font-black text-lg', ratingColor)}>
            {review.overallRating.toFixed(1)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Reviewer identity — always anonymous */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-slate-700">Anonymous Student</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 font-medium">
              Reviews are always anonymous
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {review.wouldRecommend != null && (
              <span className={cn('flex items-center gap-1 text-xs font-semibold', review.wouldRecommend ? 'text-green-600' : 'text-red-500')}>
                {review.wouldRecommend
                  ? <><CheckCircle className="h-3 w-3" /> Would Recommend</>
                  : <><XCircle className="h-3 w-3" /> Wouldn&apos;t Recommend</>
                }
              </span>
            )}
            {review.grade && (
              <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                Grade: {review.grade}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5">
            {review.termTaken && <span className="font-medium text-slate-500">{review.termTaken}</span>}
            {review.termTaken && <span>·</span>}
            <span>{timeAgo(review.createdAt)}</span>
            {showProfessor && review.professor && (
              <>
                <span>·</span>
                <Link href={`/professors/${review.professor.slug}`} className="text-blue-600 hover:underline font-medium">
                  {review.professor.fullName}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rating pills */}
      {(review.teachingClarity != null || review.workloadLevel != null || review.gradingFairness != null || review.examDifficulty != null) && (
        <div className="flex flex-wrap gap-1.5">
          <MiniRating value={review.teachingClarity} label="Clarity" />
          <MiniRating value={review.workloadLevel}   label="Workload" />
          <MiniRating value={review.gradingFairness} label="Grading" />
          <MiniRating value={review.examDifficulty}  label="Exams" />
        </div>
      )}

      {/* Tags */}
      {(() => {
        const parsedTags: string[] = Array.isArray(review.tags)
          ? review.tags
          : typeof review.tags === 'string'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (() => { try { return JSON.parse(review.tags as any) } catch { return [] } })()
          : []
        return parsedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {parsedTags.map(tag => (
              <span key={tag} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {tag}
              </span>
            ))}
          </div>
        ) : null
      })()}

      {/* Body */}
      <p className="text-sm text-slate-700 leading-relaxed">{review.body}</p>

      {/* Pros / Cons */}
      {(review.pros || review.cons) && (
        <div className={cn('grid gap-3 text-sm', review.pros && review.cons ? 'grid-cols-2' : 'grid-cols-1')}>
          {review.pros && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3.5">
              <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1.5">Pros</p>
              <p className="text-green-800 text-xs leading-relaxed">{review.pros}</p>
            </div>
          )}
          {review.cons && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3.5">
              <p className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-1.5">Cons</p>
              <p className="text-red-800 text-xs leading-relaxed">{review.cons}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
        <button
          onClick={markHelpful}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium transition-colors',
            helpful ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
          )}
        >
          <ThumbsUp className={cn('h-3.5 w-3.5', helpful && 'fill-blue-600')} />
          Helpful{helpfulCount > 0 ? ` (${helpfulCount})` : ''}
        </button>
        <button
          onClick={report}
          disabled={reported}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium transition-colors ml-auto',
            reported ? 'text-slate-300 cursor-default' : 'text-slate-400 hover:text-red-500'
          )}
        >
          <Flag className="h-3.5 w-3.5" />
          {reported ? 'Reported' : 'Report'}
        </button>
      </div>
    </div>
  )
}
