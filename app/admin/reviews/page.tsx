'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Flag, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

interface Review {
  id: string
  body: string
  pros?: string | null
  cons?: string | null
  overallRating?: number | null
  teachingClarity?: number | null
  workloadLevel?: number | null
  gradingFairness?: number | null
  examDifficulty?: number | null
  wouldRecommend?: boolean | null
  termTaken?: string | null
  grade?: string | null
  status: string
  createdAt: string
  professor?: { fullName: string; slug: string } | null
  course?: { code: string; name: string } | null
  moderationQueue?: { autoFlags: string[] } | null
  reports?: Array<{ reason: string; details: string | null }>
}

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'

export default function AdminReviewsPage() {
  const [status, setStatus] = useState<Status>('PENDING')
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reviews?status=${status}&page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews)
        setTotal(data.pagination.total)
      }
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const moderate = async (reviewId: string, action: 'APPROVE' | 'REJECT', note?: string) => {
    setActionLoading(reviewId)
    try {
      await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action, note }),
      })
      setReviews(prev => prev.filter(r => r.id !== reviewId))
      setTotal(t => t - 1)
    } finally {
      setActionLoading(null)
    }
  }

  const STATUS_TABS: Array<{ value: Status; label: string; color: string }> = [
    { value: 'PENDING', label: 'Pending', color: 'text-yellow-600' },
    { value: 'APPROVED', label: 'Approved', color: 'text-green-600' },
    { value: 'FLAGGED', label: 'Flagged', color: 'text-orange-600' },
    { value: 'REJECTED', label: 'Rejected', color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <span className="text-sm text-muted-foreground">{total} reviews</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1) }}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              status === tab.value
                ? `border-blue-600 text-blue-700`
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No {status.toLowerCase()} reviews.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {review.professor && (
                      <a href={`/professors/${review.professor.slug}`} target="_blank" rel="noreferrer"
                        className="font-semibold text-blue-700 hover:underline">
                        {review.professor.fullName}
                      </a>
                    )}
                    {review.course && (
                      <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded ml-2">
                        {review.course.code}
                      </span>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {review.overallRating != null && <span>Rating: {review.overallRating}/5</span>}
                      {review.termTaken && <span>{review.termTaken}</span>}
                      {review.grade && <span>Grade: {review.grade}</span>}
                      <span>{timeAgo(review.createdAt)}</span>
                    </div>
                  </div>
                  {review.moderationQueue?.autoFlags && review.moderationQueue.autoFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {review.moderationQueue.autoFlags.map((flag: string) => (
                        <span key={flag} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Review body */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.body}</p>

                {(review.pros || review.cons) && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {review.pros && (
                      <div className="bg-green-50 rounded p-3">
                        <strong className="text-green-700">Pros:</strong> {review.pros}
                      </div>
                    )}
                    {review.cons && (
                      <div className="bg-red-50 rounded p-3">
                        <strong className="text-red-700">Cons:</strong> {review.cons}
                      </div>
                    )}
                  </div>
                )}

                {/* User reports */}
                {review.reports && review.reports.length > 0 && (
                  <div className="bg-orange-50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium text-orange-700 mb-2">
                      <Flag className="h-4 w-4" />
                      {review.reports.length} user report{review.reports.length > 1 ? 's' : ''}
                    </div>
                    {review.reports.slice(0, 3).map((r, i) => (
                      <div key={i} className="text-xs text-orange-600">
                        {r.reason}{r.details && `: ${r.details}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {status === 'PENDING' || status === 'FLAGGED' ? (
                <div className="border-t px-5 py-3 flex items-center gap-3 bg-muted/30">
                  <button
                    onClick={() => moderate(review.id, 'APPROVE')}
                    disabled={actionLoading === review.id}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => moderate(review.id, 'REJECT')}
                    disabled={actionLoading === review.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                  {actionLoading === review.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              ) : null}
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={reviews.length < 20}
              className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
