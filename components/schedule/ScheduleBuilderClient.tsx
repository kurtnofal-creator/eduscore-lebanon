'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import {
  Search, Plus, X, ChevronLeft, ChevronRight, Loader2, Calendar, Save,
  Sparkles, GraduationCap, Clock, Star, AlertTriangle, MapPin, Users,
  ShieldCheck, HelpCircle, Zap, Database, Copy, ClipboardList, Check,
  Filter, Share2, Printer, Flag, BookOpen, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScheduleCalendar } from './ScheduleCalendar'
import { ReportSectionModal } from './ReportSectionModal'
import { OnboardingGuide } from './OnboardingGuide'
import { getCourseColors } from '@/lib/schedule-colors'
import { formatTime } from '@/lib/schedule-engine'
import type { ScheduleResult, SchedulePreference, SectionData } from '@/lib/schedule-engine'

interface Term {
  id: string
  name: string
  season: string
  year: number
}

interface University {
  id: string
  name: string
  shortName: string
  slug: string
}

interface CourseOption {
  id: string
  code: string
  name: string
  slug: string
  credits?: number | null
  department: {
    name: string
    faculty: { university: { shortName: string } }
  } | null
}

const PREFERENCE_OPTIONS: Array<{ value: SchedulePreference; label: string; desc: string; emoji: string }> = [
  { value: 'balanced',        label: 'Balanced',        desc: 'Best overall mix',           emoji: '⚖️' },
  { value: 'best_professors', label: 'Best Professors',  desc: 'Highest-rated profs first',  emoji: '⭐' },
  { value: 'light_workload',  label: 'Light Workload',   desc: 'Easiest professors first',   emoji: '🌿' },
  { value: 'fewer_days',      label: 'Fewer Days',       desc: 'Minimize campus days',       emoji: '📅' },
  { value: 'short_gaps',      label: 'Short Gaps',       desc: 'Less time between classes',  emoji: '⚡' },
  { value: 'early_start',     label: 'Early Schedule',   desc: 'Done by afternoon',          emoji: '🌅' },
  { value: 'late_start',      label: 'Late Start',       desc: 'No early morning classes',   emoji: '🌙' },
]

export function ScheduleBuilderClient({ terms, universities }: { terms: Term[]; universities: University[] }) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()

  const [selectedTerm, setSelectedTerm] = useState(terms[0]?.id ?? '')
  const [selectedUniversity, setSelectedUniversity] = useState(universities[0]?.id ?? '')
  const [selectedCourses, setSelectedCourses] = useState<CourseOption[]>([])
  const [preference, setPreference] = useState<SchedulePreference>('balanced')
  const [minProfRating, setMinProfRating] = useState(0)
  const [confirmedOnly, setConfirmedOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CourseOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [schedules, setSchedules] = useState<ScheduleResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copiedCRNs, setCopiedCRNs] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [reportingSection, setReportingSection] = useState<SectionData | null>(null)

  // ── Shared schedule URL decode on mount ─────────────────────────────────────
  useEffect(() => {
    const encoded = searchParams.get('s')
    if (!encoded) return
    try {
      const payload = JSON.parse(atob(encoded)) as { sIds: string[]; t: string }
      if (!payload.sIds || !payload.t) return
      // Fetch sections from API to reconstruct a shared schedule
      ;(async () => {
        setGenerating(true)
        const res = await fetch('/api/schedule/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionIds: payload.sIds, termId: payload.t }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.schedule) {
            setSchedules([data.schedule])
            setCurrentIndex(0)
            setSelectedTerm(payload.t)
          }
        }
        setGenerating(false)
      })()
    } catch {
      // Invalid share URL — ignore silently
    }
  }, [searchParams])

  const searchCourses = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const params = new URLSearchParams({ q, universityId: selectedUniversity, limit: '8' })
      const res = await fetch(`/api/search?${params}&type=courses`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.courses ?? [])
      }
    } finally {
      setSearchLoading(false)
    }
  }, [selectedUniversity])

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    clearTimeout((window as unknown as Record<string, unknown>)._searchTimeout as ReturnType<typeof setTimeout>)
    ;(window as unknown as Record<string, unknown>)._searchTimeout = setTimeout(() => searchCourses(q), 300)
  }

  const addCourse = (course: CourseOption) => {
    if (selectedCourses.find(c => c.id === course.id)) return
    if (selectedCourses.length >= 8) return
    setSelectedCourses(prev => [...prev, course])
    setSearchQuery('')
    setSearchResults([])
  }

  const removeCourse = (courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId))
  }

  const generateSchedules = async () => {
    if (selectedCourses.length === 0) return
    if (!selectedTerm) return
    setGenerating(true)
    setError('')
    setSchedules([])
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseIds: selectedCourses.map(c => c.id),
          termId: selectedTerm,
          preference,
          maxResults: 20,
          minProfRating,
          confirmedOnly,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate schedules')
      setSchedules(data.schedules)
      setCurrentIndex(0)

      // Track course combo for popular schedules analytics (Part 12)
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'schedule_generated',
          courseCount: selectedCourses.length,
          preference,
          resultsFound: data.schedules.length,
          courseCodes: selectedCourses.map(c => c.code).sort().join(','),
          termId: selectedTerm,
        }),
      }).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate schedules')
    } finally {
      setGenerating(false)
    }
  }

  const saveSchedule = async () => {
    if (!session?.user || schedules.length === 0) return
    const current = schedules[currentIndex]
    if (!current) return
    const res = await fetch('/api/schedules/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionIds: current.sections.map(s => s.id),
        termId: selectedTerm,
        name: `Schedule ${currentIndex + 1}`,
      }),
    })
    if (res.ok) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000) }
  }

  const shareSchedule = () => {
    const current = schedules[currentIndex]
    if (!current) return
    const payload = { sIds: current.sections.map(s => s.id), t: selectedTerm }
    const encoded = btoa(JSON.stringify(payload))
    const url = `${window.location.origin}/schedule-builder?s=${encoded}`
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }).catch(() => {})
  }

  const printSchedule = () => window.print()

  const currentSchedule = schedules[currentIndex]
  const totalCredits = selectedCourses.reduce((sum, c) => sum + (c.credits ?? 0), 0)
  const uniSlug = universities.find(u => u.id === selectedUniversity)?.slug ?? ''

  // Show stale-data notice for non-live universities (or when schedules contain stale sections)
  const selectedUniSlug = universities.find(u => u.id === selectedUniversity)?.slug ?? ''
  const isLiveUniversity = selectedUniSlug === 'aub' || selectedUniSlug === 'lau'
  const hasStaleData = currentSchedule?.sections.some(s => s.isStale) ?? false
  const showDataNotice = !isLiveUniversity || hasStaleData

  return (
    <>
      {/* First-visit onboarding guide */}
      <OnboardingGuide />

      {/* Stale / degraded data notice */}
      {showDataNotice && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <span>
            Schedule data may be temporarily outdated.
            {!isLiveUniversity && ' Live CRN data is currently available for AUB and LAU only.'}
            {hasStaleData && ' Some sections shown were last synced more than 24 hours ago.'}
          </span>
        </div>
      )}

      {/* Report modal (portal-style, outside the grid) */}
      {reportingSection && (
        <ReportSectionModal
          section={reportingSection}
          universitySlug={uniSlug}
          onClose={() => setReportingSection(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start print:block">

        {/* ── Left panel ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4 print:hidden">

          {/* Context selectors */}
          <div className="es-card p-5 space-y-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-500" /> Configure
            </h2>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">University</label>
              <select
                value={selectedUniversity}
                onChange={e => setSelectedUniversity(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              >
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.shortName} – {u.name}</option>
                ))}
              </select>
              {/* Data tier notice (Part 15) */}
              {(() => {
                const slug = universities.find(u => u.id === selectedUniversity)?.slug ?? ''
                const isLive = slug === 'aub' || slug === 'lau'
                return isLive ? (
                  <p className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1.5">
                    <Zap className="h-3 w-3" /> Live official schedule data — professor names confirmed
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-1.5">
                    <Database className="h-3 w-3" /> Historical schedule data — assignments may not reflect current term
                  </p>
                )
              })()}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Academic Term</label>
              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              >
                {terms.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Course picker */}
          <div className="es-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" /> Courses
              </h2>
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                selectedCourses.length >= 8 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
              )}>
                {selectedCourses.length}/8
              </span>
            </div>

            {/* Search input */}
            <div className="relative">
              <div className={cn(
                'flex items-center gap-2 border rounded-xl px-3 py-2.5 transition-all',
                'border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white'
              )}>
                <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder={selectedCourses.length >= 8 ? 'Max courses reached' : 'Search by code or name…'}
                  className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
                  disabled={selectedCourses.length >= 8}
                />
                {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 flex-shrink-0" />}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 z-20 overflow-hidden">
                  {searchResults.map(course => {
                    const alreadyAdded = !!selectedCourses.find(c => c.id === course.id)
                    return (
                      <button
                        key={course.id}
                        onClick={() => addCourse(course)}
                        disabled={alreadyAdded}
                        className={cn(
                          'w-full text-left px-4 py-3 transition-colors border-b border-slate-50 last:border-0',
                          alreadyAdded ? 'opacity-40 cursor-default' : 'hover:bg-blue-50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            {course.code}
                          </span>
                          <span className="text-sm text-slate-800 truncate flex-1">{course.name}</span>
                          {!alreadyAdded && <Plus className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 ml-0.5">
                          {course.department?.faculty?.university?.shortName}
                          {course.credits ? ` · ${course.credits} cr` : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected courses — consistent colors (Part 4) */}
            {selectedCourses.length > 0 ? (
              <div className="space-y-2">
                {selectedCourses.map((course, i) => {
                  const colors = getCourseColors(i)
                  return (
                    <div key={course.id} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2.5 border', colors.chip)}>
                      <span className="font-mono text-xs font-bold flex-shrink-0">{course.code}</span>
                      <span className="text-sm flex-1 truncate">{course.name}</span>
                      {course.credits != null && (
                        <span className="text-[11px] opacity-60 flex-shrink-0">{course.credits}cr</span>
                      )}
                      <button onClick={() => removeCourse(course.id)} className="p-0.5 hover:opacity-60 transition-opacity flex-shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
                {totalCredits > 0 && (
                  <p className="text-xs text-slate-400 text-right">
                    <BookOpen className="h-3 w-3 inline mr-1" />
                    {totalCredits} total credits
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                <Calendar className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Search and add up to 8 courses</p>
              </div>
            )}
          </div>

          {/* Preferences (Part 6) */}
          <div className="es-card p-5 space-y-3">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" /> Rank By
            </h2>
            <div className="grid grid-cols-1 gap-1.5">
              {PREFERENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPreference(opt.value)}
                  className={cn(
                    'flex items-center gap-3 text-left px-3.5 py-2.5 rounded-xl border transition-all text-sm',
                    preference === opt.value
                      ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700'
                  )}
                >
                  <span className="text-base leading-none">{opt.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-medium leading-none">{opt.label}</div>
                    <div className={cn('text-[11px] mt-0.5', preference === opt.value ? 'text-blue-500' : 'text-slate-400')}>{opt.desc}</div>
                  </div>
                  {preference === opt.value && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Professor filters (Part 7) */}
          <div className="es-card p-5 space-y-3">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-500" /> Filters
            </h2>

            {/* Min professor rating slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-500">Min Professor Rating</label>
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  minProfRating === 0 ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                )}>
                  {minProfRating === 0 ? 'Any' : `${minProfRating}+ ★`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={minProfRating}
                onChange={e => setMinProfRating(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Any</span>
                <span>5 ★</span>
              </div>
            </div>

            {/* Confirmed only toggle */}
            <button
              onClick={() => setConfirmedOnly(!confirmedOnly)}
              className={cn(
                'flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                confirmedOnly
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium leading-none">Confirmed professors only</div>
                <div className={cn('text-[11px] mt-0.5', confirmedOnly ? 'text-blue-500' : 'text-slate-400')}>
                  Exclude unverified assignments
                </div>
              </div>
              {confirmedOnly && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
            </button>
          </div>

          {/* Generate */}
          <button
            onClick={generateSchedules}
            disabled={selectedCourses.length === 0 || !selectedTerm || generating}
            className={cn(
              'w-full flex items-center justify-center gap-2.5 rounded-2xl px-4 py-4 font-semibold text-[15px] transition-all',
              'bg-blue-600 text-white shadow-md shadow-blue-600/25',
              'hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-md'
            )}
          >
            {generating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Generating Schedules…</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Generate Schedules</>
            )}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* ── Right panel: Results ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {generating ? (
            <div className="es-card p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
              <p className="font-semibold text-slate-900 mb-1">Finding the best schedules…</p>
              <p className="text-sm text-slate-400">Checking all section combinations for conflicts</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="es-card p-10 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">How to build your schedule</h3>
              </div>
              <ol className="space-y-5">
                {[
                  {
                    n: '1',
                    icon: Search,
                    title: 'Search for your courses',
                    desc: 'Type a course name or code in the search box. Click any result to add it to your list (up to 8 courses).',
                    color: 'bg-blue-50 text-blue-600',
                  },
                  {
                    n: '2',
                    icon: Sparkles,
                    title: 'Pick a ranking preference',
                    desc: 'Choose how to rank results — by best professors, lightest workload, fewest campus days, or more.',
                    color: 'bg-violet-50 text-violet-600',
                  },
                  {
                    n: '3',
                    icon: Calendar,
                    title: 'Generate conflict-free schedules',
                    desc: 'Hit Generate Schedules. EduScore checks every section combination and returns only the ones with no time conflicts.',
                    color: 'bg-emerald-50 text-emerald-600',
                  },
                  {
                    n: '4',
                    icon: ClipboardList,
                    title: 'Copy CRNs and register',
                    desc: 'Browse results with the arrows, then copy the CRN list and paste it into your university\'s registration portal.',
                    color: 'bg-amber-50 text-amber-600',
                  },
                ].map(({ n, icon: Icon, title, desc, color }) => (
                  <li key={n} className="flex items-start gap-4">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 leading-snug">{n}. {title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : currentSchedule ? (
            <>
              {/* Navigation bar (Parts 5 + score reasons) */}
              <div className="es-card p-4 print:hidden">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-slate-900">Schedule {currentIndex + 1}</h3>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        of {schedules.length}
                      </span>
                    </div>
                    {/* Score + reason labels (Part 5) */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full',
                        currentSchedule.score >= 80 ? 'bg-green-100 text-green-700' :
                        currentSchedule.score >= 50 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      )}>
                        Score {Math.round(currentSchedule.score)}
                      </span>
                      {currentSchedule.scoreReasons.map(r => (
                        <span key={r} className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Print button (Part 13) */}
                    <button
                      onClick={printSchedule}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border font-medium transition-all border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      title="Print schedule"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>

                    {/* Share button (Part 13) */}
                    <button
                      onClick={shareSchedule}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border font-medium transition-all',
                        shareCopied
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      )}
                    >
                      {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                      {shareCopied ? 'Copied!' : 'Share'}
                    </button>

                    {/* Save button */}
                    {session?.user && (
                      <button
                        onClick={saveSchedule}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border font-medium transition-all',
                          saveSuccess
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        )}
                      >
                        <Save className="h-3.5 w-3.5" />
                        {saveSuccess ? 'Saved!' : 'Save'}
                      </button>
                    )}

                    {/* Previous / next */}
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                        disabled={currentIndex === 0}
                        className="p-2 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                      </button>
                      <span className="text-xs font-semibold text-slate-600 px-2 border-x border-slate-200">
                        {currentIndex + 1}/{schedules.length}
                      </span>
                      <button
                        onClick={() => setCurrentIndex(i => Math.min(schedules.length - 1, i + 1))}
                        disabled={currentIndex === schedules.length - 1}
                        className="p-2 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule summary stats strip (Part 8) */}
              <div className="es-card px-5 py-3">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {totalCredits > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{totalCredits}</span>
                      <span className="text-slate-400">credits</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">{currentSchedule.metrics.daysOnCampus}</span>
                    <span className="text-slate-400">campus {currentSchedule.metrics.daysOnCampus === 1 ? 'day' : 'days'}/wk</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">
                      {formatTime(currentSchedule.metrics.earliestStart)} – {formatTime(currentSchedule.metrics.latestEnd)}
                    </span>
                  </div>
                  {currentSchedule.metrics.avgProfRating > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-semibold text-slate-700">
                        {currentSchedule.metrics.avgProfRating.toFixed(1)}
                      </span>
                      <span className="text-slate-400">avg prof</span>
                    </div>
                  )}
                  {currentSchedule.metrics.avgWorkload > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Activity className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">
                        {currentSchedule.metrics.avgWorkload.toFixed(1)}/5
                      </span>
                      <span className="text-slate-400">avg workload</span>
                    </div>
                  )}
                  {currentSchedule.metrics.totalGap > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>{currentSchedule.metrics.totalGap}min total gaps</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar (Part 3 — passes courseIds for consistent color mapping) */}
              <div className="es-card overflow-hidden">
                <ScheduleCalendar
                  sections={currentSchedule.sections}
                  courseIds={selectedCourses.map(c => c.id)}
                />
              </div>

              {/* Section details */}
              <div className="es-card p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" /> Section Details
                </h3>
                <div className="space-y-3">
                  {currentSchedule.sections.map((section, i) => {
                    // Use index within selectedCourses for consistent color (Part 4)
                    const courseIdx = selectedCourses.findIndex(c => c.id === section.courseId)
                    const colors = getCourseColors(courseIdx >= 0 ? courseIdx : i)
                    const statusColor =
                      section.status === 'OPEN'     ? 'bg-green-50 text-green-700 border-green-200' :
                      section.status === 'CLOSED'   ? 'bg-red-50 text-red-700 border-red-200' :
                      section.status === 'WAITLIST' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                      'bg-slate-50 text-slate-500 border-slate-200'
                    const lastUpdated = section.lastSyncedAt
                      ? new Date(section.lastSyncedAt).toLocaleDateString('en-LB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : null

                    return (
                      <div key={section.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className={cn('w-1 self-stretch rounded-full flex-shrink-0', colors.accent)} />
                        <div className="flex-1 min-w-0">

                          {/* Header row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                              {section.courseCode}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{section.courseName}</span>
                            <span className="text-xs text-slate-400">§{section.sectionNumber}</span>
                            {section.crn ? (
                              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                                CRN {section.crn}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-300 italic">CRN unavailable</span>
                            )}

                            {/* Seat status badge */}
                            {section.status && section.status !== 'UNKNOWN' && (
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', statusColor)}>
                                {section.status === 'OPEN' && section.seatsRemaining != null
                                  ? `${section.seatsRemaining} open`
                                  : section.status}
                              </span>
                            )}

                            {section.isStale && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                                <AlertTriangle className="h-2.5 w-2.5" /> Stale data
                              </span>
                            )}
                            {section.historicalInference && (
                              <span className="text-[10px] text-slate-400 italic">historical</span>
                            )}

                            {/* Report button (Part 14) */}
                            <button
                              onClick={() => setReportingSection(section)}
                              className="ml-auto flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                              title="Report a data issue with this section"
                            >
                              <Flag className="h-2.5 w-2.5" /> Report
                            </button>
                          </div>

                          {/* Details rows */}
                          <div className="mt-2 space-y-1">
                            {/* Professor row */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <GraduationCap className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              {section.professors.length > 0 ? (
                                <>
                                  <span>{section.professors[0].fullName}</span>
                                  {section.professors[0].overallRating != null && (
                                    <span className={cn(
                                      'font-semibold ml-0.5',
                                      section.professors[0].overallRating >= 4 ? 'text-green-600' :
                                      section.professors[0].overallRating >= 3 ? 'text-amber-600' : 'text-red-500'
                                    )}>
                                      {section.professors[0].overallRating.toFixed(1)} ★
                                    </span>
                                  )}
                                  {/* Confidence badge (Part 16) */}
                                  {section.professors[0].confidence === 'CONFIRMED' ? (
                                    <span className="flex items-center gap-0.5 text-[10px] text-green-600 font-medium bg-green-50 border border-green-200 px-1 py-0.5 rounded">
                                      <ShieldCheck className="h-2.5 w-2.5" /> Confirmed
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-[10px] text-slate-400 italic">
                                      <HelpCircle className="h-2.5 w-2.5" /> Inferred
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-300 italic">Unavailable</span>
                              )}
                            </div>

                            {section.meetings.map((m, mi) => (
                              <div key={mi} className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Clock className="h-3 w-3" />
                                <span>{m.day.slice(0, 3)} {m.startTime}–{m.endTime}</span>
                                {m.type && m.type !== 'LECTURE' && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">{m.type}</span>
                                )}
                                {m.location && (
                                  <span className="flex items-center gap-0.5 text-slate-400">
                                    <MapPin className="h-2.5 w-2.5" />{m.location}
                                  </span>
                                )}
                              </div>
                            ))}

                            {!section.meetings.some(m => m.location) && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                {section.location
                                  ? <span>{section.location}</span>
                                  : <span className="italic text-slate-300">Location unavailable</span>
                                }
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Users className="h-3 w-3 flex-shrink-0" />
                              {section.capacity != null ? (
                                <span>
                                  {section.enrolled != null ? `${section.enrolled}/` : ''}{section.capacity} seats
                                  {section.seatsRemaining != null && section.status !== 'OPEN'
                                    ? ` · ${section.seatsRemaining} remaining`
                                    : ''}
                                </span>
                              ) : (
                                <span className="italic text-slate-300">Enrollment unavailable</span>
                              )}
                            </div>

                            {lastUpdated && (
                              <div className={cn('text-[10px] mt-1', section.isStale ? 'text-amber-500' : 'text-slate-300')}>
                                {section.isStale ? 'Last updated: ' : 'Updated '}{lastUpdated}
                                {section.historicalInference && ' (historical estimate)'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Registration Summary */}
              {(() => {
                const fmtDays = (meetings: typeof currentSchedule.sections[0]['meetings']) => {
                  if (meetings.length === 0) return 'TBA'
                  const dayAbbr: Record<string, string> = {
                    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
                    THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat',
                  }
                  const seen = new Set<string>()
                  const parts: string[] = []
                  for (const m of meetings) {
                    const key = `${m.day}-${m.startTime}-${m.endTime}`
                    if (seen.has(key)) continue
                    seen.add(key)
                    parts.push(`${dayAbbr[m.day] ?? m.day} ${m.startTime}–${m.endTime}`)
                  }
                  return parts.join(', ')
                }

                const crnList = currentSchedule.sections
                  .map(s => s.crn ? `${s.courseCode} §${s.sectionNumber} — CRN: ${s.crn}` : `${s.courseCode} §${s.sectionNumber} — CRN: unavailable`)
                  .join('\n')

                const fullSummary = currentSchedule.sections.map(s => {
                  const prof = s.professors[0]?.fullName ?? 'TBA'
                  const times = fmtDays(s.meetings)
                  const crn = s.crn ?? 'unavailable'
                  return `${s.courseCode} — ${s.courseName}\n  Section: §${s.sectionNumber}  CRN: ${crn}\n  Professor: ${prof}\n  Schedule: ${times}`
                }).join('\n\n')

                const copyCRNs = () => {
                  navigator.clipboard.writeText(crnList).then(() => {
                    setCopiedCRNs(true)
                    setTimeout(() => setCopiedCRNs(false), 2000)
                  }).catch(() => {})
                }

                const copySummary = () => {
                  navigator.clipboard.writeText(fullSummary).then(() => {
                    setCopiedSummary(true)
                    setTimeout(() => setCopiedSummary(false), 2000)
                  }).catch(() => {})
                }

                return (
                  <div className="es-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-500" /> Registration Summary
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={copyCRNs}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all',
                            copiedCRNs
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          )}
                        >
                          {copiedCRNs ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedCRNs ? 'Copied!' : 'Copy CRNs'}
                        </button>
                        <button
                          onClick={copySummary}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all',
                            copiedSummary
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          )}
                        >
                          {copiedSummary ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedSummary ? 'Copied!' : 'Copy Summary'}
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left text-[11px] font-semibold text-slate-400 pb-2 pr-4">Course</th>
                            <th className="text-left text-[11px] font-semibold text-slate-400 pb-2 pr-4">Section</th>
                            <th className="text-left text-[11px] font-semibold text-slate-400 pb-2 pr-4">CRN</th>
                            <th className="text-left text-[11px] font-semibold text-slate-400 pb-2 pr-4">Professor</th>
                            <th className="text-left text-[11px] font-semibold text-slate-400 pb-2">Days / Times</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {currentSchedule.sections.map(s => {
                            const prof = s.professors[0]?.fullName ?? 'TBA'
                            const times = fmtDays(s.meetings)
                            const courseIdx = selectedCourses.findIndex(c => c.id === s.courseId)
                            const colors = getCourseColors(courseIdx >= 0 ? courseIdx : 0)
                            return (
                              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 pr-4">
                                  <div className={cn('font-mono text-xs font-bold', colors.text)}>{s.courseCode}</div>
                                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{s.courseName}</div>
                                </td>
                                <td className="py-2.5 pr-4 text-xs text-slate-600 whitespace-nowrap">§{s.sectionNumber}</td>
                                <td className="py-2.5 pr-4 whitespace-nowrap">
                                  {s.crn
                                    ? <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{s.crn}</span>
                                    : <span className="text-[11px] text-slate-400 italic">unavailable</span>
                                  }
                                </td>
                                <td className="py-2.5 pr-4 text-xs text-slate-600 max-w-[140px] truncate">{prof}</td>
                                <td className="py-2.5 text-[11px] text-slate-500">{times}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
