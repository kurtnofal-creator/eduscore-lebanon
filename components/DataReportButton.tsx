'use client'

import { useState } from 'react'
import { Flag, X, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  universitySlug: string
  courseCode?: string
  sectionId?: string
  professorSlug?: string
  page?: string
}

export function DataReportButton({ universitySlug, courseCode, sectionId, professorSlug, page }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (message.trim().length < 5) { setError('Please describe the issue (at least 5 characters).'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/data-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universitySlug, courseCode, sectionId, professorSlug, page, message: message.trim() }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => { setOpen(false); setDone(false); setMessage('') }, 2500)
      } else {
        setError('Failed to submit. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        title="Report incorrect data"
      >
        <Flag className="h-3.5 w-3.5" />
        Report incorrect data
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Report incorrect data</h2>
                {courseCode && <p className="text-xs text-slate-500 mt-0.5">{courseCode}</p>}
                {professorSlug && !courseCode && <p className="text-xs text-slate-500 mt-0.5">{professorSlug}</p>}
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {done ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Thank you for the report!</p>
                <p className="text-xs text-slate-400 mt-1">Our team will review it shortly.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">
                    What&apos;s wrong? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g. Wrong professor assigned, incorrect meeting time, missing section..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <div className="text-right text-xs text-slate-400 mt-0.5">{message.length}/1000</div>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Submit report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
