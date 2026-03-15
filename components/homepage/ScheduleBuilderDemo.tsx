'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Calendar, Clock, Star, Copy, Check } from 'lucide-react'

const COURSES = [
  { code: 'CMPS 201', color: 'blue' },
  { code: 'MATH 201', color: 'violet' },
  { code: 'EECE 230', color: 'emerald' },
  { code: 'ENGL 102', color: 'amber' },
]

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; sub: string }> = {
  blue:    { bg: 'bg-blue-100',    border: 'border-blue-200',    text: 'text-blue-700',    sub: 'text-blue-500' },
  violet:  { bg: 'bg-violet-100',  border: 'border-violet-200',  text: 'text-violet-700',  sub: 'text-violet-500' },
  emerald: { bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-700', sub: 'text-emerald-500' },
  amber:   { bg: 'bg-amber-100',   border: 'border-amber-200',   text: 'text-amber-700',   sub: 'text-amber-500' },
}

// Calendar grid: day → list of { code, color, time }
const CALENDAR: Array<Array<{ code: string; color: string; time: string } | null>> = [
  [{ code: 'CMPS 201', color: 'blue',    time: '8:00–9:15' },   null, null],
  [{ code: 'MATH 201', color: 'violet',  time: '10:00–11:15' }, null, null],
  [{ code: 'CMPS 201', color: 'blue',    time: '8:00–9:15' },   { code: 'EECE 230', color: 'emerald', time: '14:00–15:15' }, null],
  [{ code: 'MATH 201', color: 'violet',  time: '10:00–11:15' }, { code: 'ENGL 102', color: 'amber',   time: '13:00–14:15' }, null],
  [{ code: 'EECE 230', color: 'emerald', time: '9:00–10:15' },  null, null],
]

// How many calendar blocks are visible per phase (0–4)
const PHASE_VISIBLE = [0, 2, 4, 6, 8]
const PHASE_DURATION = [800, 1400, 1000, 1200, 2000] // ms per phase

export function ScheduleBuilderDemo() {
  const [phase, setPhase] = useState(0)
  const [copied, setCopied] = useState(false)
  const [visibleCourses, setVisibleCourses] = useState(0)

  // Cycle through phases
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase(p => {
        const next = (p + 1) % 5
        if (next === 0) {
          setVisibleCourses(0)
          setCopied(false)
        }
        return next
      })
    }, PHASE_DURATION[phase])
    return () => clearTimeout(timer)
  }, [phase])

  // Reveal course chips one by one during phase 1
  useEffect(() => {
    if (phase === 1 && visibleCourses < COURSES.length) {
      const t = setTimeout(() => setVisibleCourses(c => c + 1), 260)
      return () => clearTimeout(t)
    }
  }, [phase, visibleCourses])

  // Copy CRN flash in phase 4
  useEffect(() => {
    if (phase === 4) {
      const t = setTimeout(() => setCopied(true), 600)
      return () => clearTimeout(t)
    }
  }, [phase])

  // Count visible calendar blocks
  const blocksVisible = PHASE_VISIBLE[phase] ?? 0

  // Flatten calendar blocks in render order
  const allBlocks: Array<{ colIdx: number; rowIdx: number; code: string; color: string; time: string }> = []
  for (let col = 0; col < CALENDAR.length; col++) {
    for (let row = 0; row < CALENDAR[col].length; row++) {
      const b = CALENDAR[col][row]
      if (b) allBlocks.push({ colIdx: col, rowIdx: row, ...b })
    }
  }

  const isGenerating = phase === 2

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.12)' }}>

      {/* Mock header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-slate-400 ml-2">
            {isGenerating ? 'Generating schedules…' : phase >= 3 ? 'Schedule 1 of 12' : 'Add your courses'}
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all duration-300 ${
          phase >= 3 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
        }`}>
          {phase >= 3 ? 'Score 94' : '—'}
        </span>
      </div>

      {/* Course chips row */}
      <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5 min-h-[40px]">
        {COURSES.slice(0, Math.max(visibleCourses, phase >= 3 ? 4 : 0)).map((c, i) => {
          const cls = COLOR_MAP[c.color]
          return (
            <span
              key={c.code}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border animate-scale-in ${cls.bg} ${cls.border} ${cls.text}`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {c.code}
            </span>
          )
        })}
        {isGenerating && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 animate-pulse">
            Finding combinations…
          </span>
        )}
      </div>

      {/* Stats strip */}
      <div className={`flex gap-5 px-4 py-2.5 bg-white border-b border-slate-100 text-xs text-slate-500 transition-opacity duration-500 ${phase >= 3 ? 'opacity-100' : 'opacity-0'}`}>
        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3 text-slate-400" /><strong className="text-slate-700">15</strong> credits</span>
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" /><strong className="text-slate-700">4</strong> campus days</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /><strong className="text-slate-700">8:00–17:00</strong></span>
        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /><strong className="text-slate-700">4.2</strong> avg prof</span>
      </div>

      {/* Week calendar */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold text-slate-400 text-center mb-1.5">
          {['MON', 'TUE', 'WED', 'THU', 'FRI'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-5 gap-1 h-32">
          {CALENDAR.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-1">
              {col.map((block, rowIdx) => {
                if (!block) return null
                const blockIndex = allBlocks.findIndex(b => b.colIdx === colIdx && b.rowIdx === rowIdx)
                const isVisible = blockIndex < blocksVisible
                const cls = COLOR_MAP[block.color]
                return (
                  <div
                    key={rowIdx}
                    className={`rounded-lg p-1.5 flex-1 border cal-block-anim ${cls.bg} ${cls.border}`}
                    style={{
                      opacity: isVisible ? 1 : 0,
                      animationPlayState: isVisible ? 'running' : 'paused',
                      animationDelay: `${blockIndex * 0.12}s`,
                    }}
                  >
                    <p className={`text-[9px] font-bold leading-tight ${cls.text}`}>{block.code}</p>
                    <p className={`text-[8px] ${cls.sub}`}>{block.time}</p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* CRN strip */}
      <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 flex items-center justify-between">
        <div className="text-[10px] text-slate-400 font-mono">CRNs: 10234, 10891, 11042, 11340</div>
        <button
          className={`flex items-center gap-1 text-[10px] font-semibold rounded-lg px-2 py-1 border transition-all duration-300 ${
            copied
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-blue-50 text-blue-600 border-blue-200'
          }`}
        >
          {copied ? <><Check className="h-2.5 w-2.5" /> Copied!</> : <><Copy className="h-2.5 w-2.5" /> Copy CRNs</>}
        </button>
      </div>
    </div>
  )
}
