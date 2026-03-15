'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ThumbsUp, Flag, CheckCircle, XCircle, Pencil, Trash2, X, Loader2 } from 'lucide-react'
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
    updatedAt?: Date | string | null
    professor?: { id: string; fullName: string; slug: string } | null
  }
  showProfessor?: boolean
  isOwner?: boolean
}

function MiniRating({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return null
  const color =
    value >= 4
      ? 'text-green-700 bg-green-50 border-green-100'
      : value >= 3
      ? 'text-amber-700 bg-amber-50 border-amber-100'
      : 'text-red-700 bg-red-50 border-red-100'
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border', color)}>
      {value.toFixed(1)} <span className="font-normal opacity-70">{label}</span>
    </span>
  )
}

function wasEdited(createdAt: Date | string, updatedAt?: Date | string | null) {
  if (!updatedAt) return false
  const created = new Date(createdAt).getTime()
  const updated = new Date(updatedAt).getTime()
  return updated - created > 5000 // more than 5s difference = edited
}

export function ReviewCard({ review, showProfessor = false, isOwner = false }: ReviewCardProps) {
  const [helpful, setHelpful] = useState(false)
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount)
  const [reported, setReported] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editBody, setEditBody] = useState(review.body)
  const [editPros, setEditPros] = useState(review.pros ?? '')
  const [editCons, setEditCons] = useState(review.cons ?? '')
  const [editError, setEditError] = useState('')
  const [currentBody, setCurrentBody] = useState(review.body)
  const [currentPros, setCurrentPros] = useState(review.pros ?? '')
  const [currentCons, setCurrentCons] = useState(review.cons ?? '')
  const [editedAt, setEditedAt] = useState<Date | string | null>(review.updatedAt ?? null)
  const [isEdited, setIsEdited] = useState(() => wasEdited(review.createdAt, review.updatedAt))

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

  const saveEdit = async () => {
    if (editBody.trim().length < 20) {
      setEditError('Review must be at least 20 characters.')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: editBody.trim(),
          pros: editPros.trim() || undefined,
          cons: editCons.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setCurrentBody(editBody.trim())
      setCurrentPros(editPros.trim())
      setCurrentCons(editCons.trim())
      setEditing(false)
      setIsEdited(true)
      setEditedAt(new Date())
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const deleteReview = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to delete')
      }
      setDeleted(true)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong.')
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  if (deleted) {
    return (
      <div className="es-card p-5 text-center text-sm text-slate-400 italic">
        Review deleted.
      </div>
    )
  }

  const ratingColor =
    (review.overallRating ?? 0) >= 4
      ? 'bg-green-500 border-green-400'
      : (review.overallRating ?? 0) >= 3
      ? 'bg-amber-400 border-amber-300'
      : 'bg-red-500 border-red-400'

  const parsedTags: string[] = Array.isArray(review.tags)
    ? review.tags
    : typeof review.tags === 'string'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (() => { try { return JSON.parse(review.tags as any) } catch { return [] } })()
    : []

  return (
    <div className="es-card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        {review.overallRating != null && (
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border text-white font-black text-lg',
              ratingColor
            )}
          >
            {review.overallRating.toFixed(1)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-slate-700">Anonymous Student</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 font-medium">
              Always anonymous
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {review.wouldRecommend != null && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-semibold',
                  review.wouldRecommend ? 'text-green-600' : 'text-red-500'
                )}
              >
                {review.wouldRecommend ? (
                  <><CheckCircle className="h-3 w-3" /> Would Recommend</>
                ) : (
                  <><XCircle className="h-3 w-3" /> Wouldn&apos;t Recommend</>
                )}
              </span>
            )}
            {review.grade && (
              <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                Grade: {review.grade}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5 flex-wrap">
            {review.termTaken && <span className="font-medium text-slate-500">{review.termTaken}</span>}
            {review.termTaken && <span>·</span>}
            <span>{timeAgo(review.createdAt)}</span>
            {isEdited && editedAt && (
              <>
                <span>·</span>
                <span className="text-slate-400 italic">Edited {timeAgo(editedAt)}</span>
              </>
            )}
            {showProfessor && review.professor && (
              <>
                <span>·</span>
                <Link
                  href={`/professors/${review.professor.slug}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {review.professor.fullName}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Owner controls */}
        {isOwner && !editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setEditing(true); setConfirmDelete(false) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit review"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete review"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {isOwner && editing && (
          <button
            onClick={() => { setEditing(false); setEditError(''); setEditBody(currentBody); setEditPros(currentPros); setEditCons(currentCons) }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
      {parsedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {parsedTags.map(tag => (
            <span
              key={tag}
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Inline edit form */}
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <textarea
              value={editPros}
              onChange={e => setEditPros(e.target.value)}
              placeholder="Pros (optional)"
              rows={2}
              maxLength={500}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <textarea
              value={editCons}
              onChange={e => setEditCons(e.target.value)}
              placeholder="Cons (optional)"
              rows={2}
              maxLength={500}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {editError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}
          <button
            onClick={saveEdit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      ) : (
        <>
          {/* Body */}
          <p className="text-sm text-slate-700 leading-relaxed">{currentBody}</p>

          {/* Pros / Cons */}
          {(currentPros || currentCons) && (
            <div className={cn('grid gap-3 text-sm', currentPros && currentCons ? 'grid-cols-2' : 'grid-cols-1')}>
              {currentPros && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1.5">Pros</p>
                  <p className="text-green-800 text-xs leading-relaxed">{currentPros}</p>
                </div>
              )}
              {currentCons && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-1.5">Cons</p>
                  <p className="text-red-800 text-xs leading-relaxed">{currentCons}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && !editing && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 flex items-center gap-3">
          <p className="text-sm text-red-700 flex-1">Delete this review permanently?</p>
          <button
            onClick={deleteReview}
            disabled={saving}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
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
        {!isOwner && (
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
        )}
      </div>
    </div>
  )
}
