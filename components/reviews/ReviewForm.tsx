'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2, CheckCircle, ShieldCheck, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewFormProps {
  professorId?: string
  professorName?: string
  courseId?: string
  courseName?: string
  /** Optional list of courses this professor teaches, for the dropdown */
  professorCourses?: Array<{ id: string; code: string; name: string }>
}

// ── Rating fields ─────────────────────────────────────────────────────────────
const RATING_FIELDS = [
  {
    key: 'overallRating',
    label: 'Overall Rating',
    required: true,
    lowLabel: 'Terrible',
    highLabel: 'Excellent',
  },
  {
    key: 'teachingClarity',
    label: 'Teaching Clarity',
    required: false,
    lowLabel: 'Very confusing',
    highLabel: 'Crystal clear',
  },
  {
    key: 'gradingFairness',
    label: 'Grading Fairness',
    required: false,
    lowLabel: 'Very harsh',
    highLabel: 'Very fair',
  },
  {
    key: 'attendanceStrict',
    label: 'Attendance Policy',
    required: false,
    lowLabel: 'Never checks',
    highLabel: 'Mandatory',
  },
]

// ── Term options ──────────────────────────────────────────────────────────────
const TERM_OPTIONS = [
  'Spring 2026', 'Fall 2025', 'Summer 2025',
  'Spring 2025', 'Fall 2024', 'Summer 2024',
  'Spring 2024', 'Fall 2023', 'Summer 2023',
  'Spring 2023', 'Fall 2022',
]

const DIFFICULTY_OPTIONS = [
  { label: 'Easy', value: 2 },
  { label: 'Medium', value: 3 },
  { label: 'Hard', value: 5 },
]

const WORKLOAD_OPTIONS = [
  { label: 'Light', value: 2 },
  { label: 'Medium', value: 3 },
  { label: 'Heavy', value: 5 },
]

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'W', 'I', 'P/F']

const REVIEW_TAGS = [
  'Clear lecturer', 'Tough grader', 'Heavy workload', 'Easy exams',
  'Fair grading', 'Attendance mandatory', 'Lots of homework',
  'Helpful office hours', 'Engaging lectures', 'Inspirational',
]

const STEP_LABELS = ['Ratings', 'Context', 'Tags', 'Written', 'Submit']

// ── Star rating input ─────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  label,
  required,
  lowLabel,
  highLabel,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  required?: boolean
  lowLabel?: string
  highLabel?: string
}) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {value > 0 && (
          <span className="text-xs font-semibold text-blue-600 tabular-nums">{value}/5</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                active >= star
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-200 hover:text-amber-200'
              )}
            />
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  )
}

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                i + 1 < step
                  ? 'bg-blue-600 text-white'
                  : i + 1 === step
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                  : 'bg-slate-100 text-slate-400'
              )}
            >
              {i + 1 < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium hidden sm:block',
                i + 1 === step ? 'text-blue-600' : 'text-slate-400'
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((step - 1) / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ReviewForm({
  professorId,
  professorName,
  courseId,
  courseName,
  professorCourses = [],
}: ReviewFormProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5

  // Form state
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [workload, setWorkload] = useState<number | null>(null)
  const [body, setBody] = useState('')
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [grade, setGrade] = useState('')
  const [termTaken, setTermTaken] = useState('')
  const [courseTaken, setCourseTaken] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const setRating = (key: string, value: number) => setRatings(prev => ({ ...prev, [key]: value }))

  // Step validation
  const canAdvance = () => {
    if (step === 1) return !!ratings.overallRating
    if (step === 4) return body.trim().length >= 20
    return true
  }

  const next = () => {
    if (!canAdvance()) {
      if (step === 1) setError('Please give an overall rating to continue.')
      else if (step === 4) setError('Review must be at least 20 characters.')
      return
    }
    setError('')
    setStep(s => Math.min(s + 1, TOTAL_STEPS))
  }

  const back = () => {
    setError('')
    setStep(s => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
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
          examDifficulty: difficulty ?? undefined,
          workloadLevel: workload ?? undefined,
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
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="h-7 w-7 text-green-500" />
        </div>
        <p className="font-semibold text-green-700 text-base">Review submitted!</p>
        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
          It will appear after our moderation review — usually within a few minutes.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4">
        Reviewing: <span className="font-semibold text-slate-800">{professorName ?? courseName}</span>
      </p>

      <StepProgress step={step} total={TOTAL_STEPS} />

      {/* ── Step 1: Ratings ───────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <p className="text-sm font-semibold text-slate-700">Rate this professor</p>
          {RATING_FIELDS.map(field => (
            <StarRating
              key={field.key}
              label={field.label}
              value={ratings[field.key] ?? 0}
              onChange={v => setRating(field.key, v)}
              required={field.required}
              lowLabel={field.lowLabel}
              highLabel={field.highLabel}
            />
          ))}
        </div>
      )}

      {/* ── Step 2: Course context ────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-700">Course context</p>

          {/* Course taken — dropdown if professor has listed courses, else text */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Course taken <span className="text-red-500">*</span>
            </label>
            {professorCourses.length > 0 ? (
              <select
                value={courseTaken}
                onChange={e => setCourseTaken(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                <option value="">Select a course</option>
                {professorCourses.map(c => (
                  <option key={c.id} value={`${c.code} ${c.name}`}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={courseTaken}
                onChange={e => setCourseTaken(e.target.value)}
                placeholder="e.g. PSPA 210 – Public Administration"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Term taken — dropdown */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Term taken</label>
            <select
              value={termTaken}
              onChange={e => setTermTaken(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="">Select a term</option>
              {TERM_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Grade received <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="">Prefer not to say</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Step 3: Tags + Difficulty / Workload ─────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-sm font-semibold text-slate-700">Quick tags</p>

          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map(tag => {
              const active = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setTags(prev =>
                      active ? prev.filter(t => t !== tag) : [...prev, tag]
                    )
                  }
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Exam difficulty
              </p>
              <div className="flex gap-1.5">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() =>
                      setDifficulty(prev => prev === opt.value ? null : opt.value)
                    }
                    className={cn(
                      'flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors',
                      difficulty === opt.value
                        ? opt.label === 'Easy'   ? 'bg-green-600 text-white border-green-600'
                        : opt.label === 'Medium' ? 'bg-blue-500 text-white border-blue-500'
                        :                         'bg-red-600 text-white border-red-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Workload
              </p>
              <div className="flex gap-1.5">
                {WORKLOAD_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() =>
                      setWorkload(prev => prev === opt.value ? null : opt.value)
                    }
                    className={cn(
                      'flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors',
                      workload === opt.value
                        ? opt.label === 'Light'  ? 'bg-green-600 text-white border-green-600'
                        : opt.label === 'Medium' ? 'bg-blue-500 text-white border-blue-500'
                        :                         'bg-red-600 text-white border-red-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Written review ────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-700">Write your review</p>

          {/* Main body */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Your experience <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe your experience. What was class like? Was grading fair? Any tips for future students?"
              rows={5}
              maxLength={2000}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className={cn(
              'text-xs text-right mt-1 tabular-nums',
              body.length < 20 ? 'text-red-400' : 'text-slate-400'
            )}>
              {body.length}/2000 {body.length < 20 && `(need ${20 - body.length} more)`}
            </p>
          </div>

          {/* Pros / Cons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Pros <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={pros}
                onChange={e => setPros(e.target.value)}
                placeholder="What stood out positively?"
                rows={2}
                maxLength={500}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Cons <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={cons}
                onChange={e => setCons(e.target.value)}
                placeholder="What could be improved?"
                rows={2}
                maxLength={500}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Would recommend */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Would you recommend this professor?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors',
                  wouldRecommend === true
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                Yes, recommend
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors',
                  wouldRecommend === false
                    ? 'bg-red-600 text-white border-red-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                No, wouldn&apos;t
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Confirm & submit ──────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-700">Review summary</p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Overall rating</span>
              <span className="font-bold text-slate-900">{ratings.overallRating ?? '—'}/5</span>
            </div>
            {termTaken && (
              <div className="flex justify-between">
                <span className="text-slate-500">Term</span>
                <span className="font-medium text-slate-700">{termTaken}</span>
              </div>
            )}
            {courseTaken && (
              <div className="flex justify-between">
                <span className="text-slate-500">Course</span>
                <span className="font-medium text-slate-700 text-right max-w-[60%] truncate">{courseTaken}</span>
              </div>
            )}
            {grade && (
              <div className="flex justify-between">
                <span className="text-slate-500">Grade</span>
                <span className="font-mono font-bold text-slate-700">{grade}</span>
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 flex-shrink-0">Tags</span>
                <span className="text-slate-700 text-right text-xs">{tags.join(', ')}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500 line-clamp-3">{body}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Your review is <strong>completely anonymous</strong>. Your identity will never be visible to professors, other students, or anyone else on the platform.
            </p>
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mt-6">
        {step > 1 && (
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={next}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              'Submit Review'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
