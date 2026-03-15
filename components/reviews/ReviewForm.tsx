'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2, CheckCircle, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewFormProps {
  professorId?: string
  professorName?: string
  courseId?: string
  courseName?: string
}

const RATING_FIELDS = [
  { key: 'overallRating', label: 'Overall Rating', required: true },
  { key: 'teachingClarity', label: 'Teaching Clarity' },
  { key: 'workloadLevel', label: 'Workload Level (1=light, 5=heavy)' },
  { key: 'gradingFairness', label: 'Grading Fairness' },
  { key: 'examDifficulty', label: 'Exam Difficulty (1=easy, 5=hard)' },
  { key: 'attendanceStrict', label: 'Attendance Strictness' },
  { key: 'participation', label: 'Participation Importance' },
]

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'W', 'I']

const REVIEW_TAGS = [
  'Clear lecturer',
  'Tough grader',
  'Heavy workload',
  'Easy exams',
  'Fair grading',
  'Attendance mandatory',
  'Lots of homework',
]

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-44 flex-shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                (hover || value) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>
      {value > 0 && <span className="text-xs text-muted-foreground">{value}/5</span>}
    </div>
  )
}

export function ReviewForm({ professorId, professorName, courseId, courseName }: ReviewFormProps) {
  const router = useRouter()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [body, setBody] = useState('')
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [grade, setGrade] = useState('')
  const [termTaken, setTermTaken] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const setRating = (key: string, value: number) => {
    setRatings(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ratings.overallRating) {
      setError('Please provide an overall rating.')
      return
    }
    if (body.trim().length < 20) {
      setError('Review must be at least 20 characters.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professorId,
          courseId,
          termTaken: termTaken || undefined,
          body: body.trim(),
          pros: pros.trim() || undefined,
          cons: cons.trim() || undefined,
          wouldRecommend: wouldRecommend ?? undefined,
          grade: grade || undefined,
          tags: tags.length > 0 ? tags : undefined,
          ...ratings,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit review')

      setSuccess(true)
      setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
        <p className="font-medium text-green-700">Review submitted!</p>
        <p className="text-sm text-muted-foreground mt-1">
          It will appear after passing our content review.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Reviewing: <span className="font-medium text-foreground">{professorName ?? courseName}</span>
      </p>

      {/* Star ratings */}
      <div className="space-y-2">
        {RATING_FIELDS.map(field => (
          <StarRating
            key={field.key}
            label={field.label}
            value={ratings[field.key] ?? 0}
            onChange={v => setRating(field.key, v)}
          />
        ))}
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Quick tags <span className="text-slate-400 font-normal">(optional)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_TAGS.map(tag => {
            const active = tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border transition-colors',
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700'
                )}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      {/* Would recommend */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Would you recommend?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWouldRecommend(true)}
            className={cn(
              'flex-1 py-2 text-sm rounded-lg border transition-colors',
              wouldRecommend === true
                ? 'bg-green-600 text-white border-green-600'
                : 'hover:bg-muted'
            )}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldRecommend(false)}
            className={cn(
              'flex-1 py-2 text-sm rounded-lg border transition-colors',
              wouldRecommend === false
                ? 'bg-red-600 text-white border-red-600'
                : 'hover:bg-muted'
            )}
          >
            No
          </button>
        </div>
      </div>

      {/* Grade + Term */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Grade (optional)</label>
          <select
            value={grade}
            onChange={e => setGrade(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select</option>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Term taken</label>
          <input
            type="text"
            value={termTaken}
            onChange={e => setTermTaken(e.target.value)}
            placeholder="e.g. Fall 2024"
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Review body */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Your review <span className="text-red-500">*</span>
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Share your academic experience (20–2000 characters)..."
          rows={4}
          maxLength={2000}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-muted-foreground text-right mt-1">{body.length}/2000</p>
      </div>

      {/* Pros / Cons */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Pros</label>
          <textarea
            value={pros}
            onChange={e => setPros(e.target.value)}
            placeholder="What was good?"
            rows={2}
            maxLength={500}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Cons</label>
          <textarea
            value={cons}
            onChange={e => setCons(e.target.value)}
            placeholder="What could improve?"
            rows={2}
            maxLength={500}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Reviews are anonymous and subject to moderation. Personal attacks, political statements, and harassment will be removed.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Review'}
      </button>

      <p className="flex items-center gap-1.5 text-sm text-slate-500">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-slate-400" />
        Reviews are always anonymous. Your identity will never be visible to professors or other students.
      </p>
    </form>
  )
}
