'use client'

import { useState } from 'react'
import { X, Flag, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SectionData } from '@/lib/schedule-engine'

interface Props {
  section: SectionData | null
  universitySlug: string
  onClose: () => void
}

const ISSUE_TYPES = [
  'Wrong professor',
  'Wrong meeting time or day',
  'Wrong room / location',
  'CRN missing or incorrect',
  'Section is full / no longer available',
  'Duplicate section listing',
  'Other issue',
]

export function ReportSectionModal({ section, universitySlug, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!section) return null

  const toggle = (type: string) => {
    setSelected(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const canSubmit = selected.length > 0 || details.trim().length >= 3

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    const parts: string[] = []
    if (selected.length > 0) parts.push(`Issues: ${selected.join(', ')}`)
    if (details.trim()) parts.push(details.trim())
    const message = parts.join('\n\n')

    await fetch('/api/data-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        universitySlug,
        courseCode: section.courseCode,
        sectionId: section.id,
        page: '/schedule-builder',
        message,
      }),
    }).catch(() => {})

    setSubmitting(false)
    setSubmitted(true)
    setTimeout(onClose, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-semibold text-slate-900">Report submitted</p>
            <p className="text-sm text-slate-400 mt-1">Thank you for helping improve data quality.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-red-500" />
                  Report a Data Issue
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {section.courseCode} — {section.courseName} §{section.sectionNumber}
                  {section.crn ? ` · CRN ${section.crn}` : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Issue type checkboxes */}
            <div className="space-y-1.5 mb-4">
              {ISSUE_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggle(type)}
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    selected.includes(type)
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <span className={cn(
                    'inline-flex w-4 h-4 rounded border mr-2 items-center justify-center text-[10px] flex-shrink-0',
                    selected.includes(type) ? 'bg-red-500 border-red-500 text-white' : 'border-slate-300'
                  )}>
                    {selected.includes(type) ? '✓' : ''}
                  </span>
                  {type}
                </button>
              ))}
            </div>

            {/* Free-text details */}
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Additional details (optional)…"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
            />

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Reports are reviewed by our team within 48 hours. Thank you.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
