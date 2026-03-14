'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, BookOpen, Sparkles, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'eduscore_onboarding_done'

const STEPS = [
  {
    icon: BookOpen,
    title: 'Add courses you want to take',
    body:  'Search for courses by name or code, then click to add them to your list. You can add up to 8 courses.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Sparkles,
    title: 'Generate conflict-free schedules',
    body:  'Click Generate Schedules and EduScore will find every valid combination — no time conflicts, ranked by professor ratings and your preferences.',
    color: 'bg-violet-100 text-violet-600',
  },
  {
    icon: ClipboardList,
    title: 'Copy CRNs and register',
    body:  'When you find a schedule you like, copy the CRN list and use it to register on your university\'s portal.',
    color: 'bg-emerald-100 text-emerald-600',
  },
]

export function OnboardingGuide() {
  const [visible, setVisible] = useState(false)
  const [step, setStep]       = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, '1')
    }
    setVisible(false)
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const Icon    = current.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Quick guide · Step {step + 1} of {STEPS.length}
          </p>
          <button
            onClick={dismiss}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
            aria-label="Skip guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step progress dots */}
        <div className="flex gap-1.5 px-6 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'bg-blue-500 w-6' : i < step ? 'bg-blue-300 w-3' : 'bg-slate-200 w-3',
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', current.color)}>
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{current.title}</h2>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{current.body}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip guide
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            {step < STEPS.length - 1 ? (
              <>Next <ChevronRight className="h-4 w-4" /></>
            ) : (
              'Get started'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
