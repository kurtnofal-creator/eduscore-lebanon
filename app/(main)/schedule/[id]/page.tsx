import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Calendar, BookOpen, Clock, Star, Copy, ArrowRight } from 'lucide-react'
import { CopyButton } from '@/components/schedule/CopyButton'

interface Props { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

const DAY_NAMES: Record<string, string> = {
  M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', F: 'Fri', S: 'Sat', U: 'Sun',
}

function formatTime(t: string | null | undefined) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const schedule = await prisma.savedSchedule.findUnique({ where: { id } })
  if (!schedule) return { title: 'Schedule Not Found' }
  return {
    title: `${schedule.name} – Shared Schedule | EduScore`,
    description: `View this shared university schedule on EduScore Lebanon.`,
  }
}

export default async function SharedSchedulePage({ params }: Props) {
  const { id } = await params

  const schedule = await prisma.savedSchedule.findUnique({
    where: { id },
    include: {
      sections: {
        include: {
          section: {
            include: {
              course: { select: { id: true, code: true, name: true, slug: true, credits: true } },
              professors: {
                include: {
                  professor: { select: { id: true, fullName: true, slug: true, overallRating: true } },
                },
              },
              meetings: { orderBy: { day: 'asc' } },
              term: { select: { id: true, name: true, year: true, season: true } },
            },
          },
        },
      },
    },
  })

  if (!schedule) notFound()

  const sections = schedule.sections.map(ss => ss.section)
  const term = sections[0]?.term
  const totalCredits = sections.reduce((sum, s) => sum + (s.course.credits ?? 0), 0)

  // Build weekly calendar grid (hour rows × day columns)
  const days = ['M', 'T', 'W', 'R', 'F']
  const hours = Array.from({ length: 15 }, (_, i) => i + 7) // 7 AM – 9 PM

  type CalBlock = {
    code: string
    name: string
    start: string
    end: string
    color: string
    rowStart: number
    rowSpan: number
  }

  const COLORS = [
    'bg-blue-100 border-blue-300 text-blue-800',
    'bg-violet-100 border-violet-300 text-violet-800',
    'bg-emerald-100 border-emerald-300 text-emerald-800',
    'bg-amber-100 border-amber-300 text-amber-800',
    'bg-pink-100 border-pink-300 text-pink-800',
    'bg-cyan-100 border-cyan-300 text-cyan-800',
  ]

  const calGrid: Record<string, CalBlock[]> = {}
  sections.forEach((sec, idx) => {
    const color = COLORS[idx % COLORS.length]
    sec.meetings.forEach(meeting => {
      const dayLetters = meeting.day.split('') // e.g. "MWF" → ['M','W','F']
      dayLetters.forEach(d => {
        if (!days.includes(d)) return
        const startH = meeting.startTime ? parseInt(meeting.startTime.split(':')[0]) : 0
        const startM = meeting.startTime ? parseInt(meeting.startTime.split(':')[1]) : 0
        const endH = meeting.endTime ? parseInt(meeting.endTime.split(':')[0]) : 0
        const endM = meeting.endTime ? parseInt(meeting.endTime.split(':')[1]) : 0
        const rowStart = (startH - 7) * 2 + Math.round(startM / 30) + 1
        const rowEnd = (endH - 7) * 2 + Math.round(endM / 30) + 1
        const rowSpan = Math.max(1, rowEnd - rowStart)
        if (!calGrid[d]) calGrid[d] = []
        calGrid[d].push({
          code: sec.course.code,
          name: sec.course.name,
          start: meeting.startTime ?? '',
          end: meeting.endTime ?? '',
          color,
          rowStart,
          rowSpan,
        })
      })
    })
  })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <p className="section-label">Shared schedule</p>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{schedule.name}</h1>
            {term && (
              <p className="text-slate-500 mt-1">
                {term.season} {term.year} &nbsp;·&nbsp; {sections.length} course{sections.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {totalCredits} credits
              </p>
            )}
          </div>
          <CopyButton
            text={typeof window !== 'undefined' ? window.location.href : ''}
            scheduleId={id}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <Copy className="h-4 w-4" /> Copy share link
          </CopyButton>
        </div>
      </div>

      {/* Course list + CRNs */}
      <div className="es-card p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-500" /> Courses &amp; CRNs
        </h2>
        <div className="space-y-3">
          {sections.map(sec => {
            const profs = sec.professors.map(sp => sp.professor)
            const mainProf = profs[0]
            return (
              <div key={sec.id} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900 text-sm">{sec.course.code}</span>
                    <span className="text-slate-600 text-sm truncate">{sec.course.name}</span>
                    {sec.course.credits != null && (
                      <span className="text-[11px] bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 font-medium">
                        {sec.course.credits} cr
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                    {mainProf && (
                      <Link href={`/professors/${mainProf.slug}`} className="flex items-center gap-1 text-blue-600 hover:underline font-medium">
                        {mainProf.fullName}
                        {mainProf.overallRating != null && (
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                            <Star className="h-3 w-3 fill-amber-400" />
                            {mainProf.overallRating.toFixed(1)}
                          </span>
                        )}
                      </Link>
                    )}
                    {sec.meetings.slice(0, 1).map(m => (
                      <span key={m.id} className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {m.day.split('').map(d => DAY_NAMES[d] ?? d).join('/')}
                        {m.startTime && ` ${formatTime(m.startTime)}–${formatTime(m.endTime)}`}
                      </span>
                    ))}
                  </div>
                </div>
                {sec.crn && (
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[10px] text-slate-400 block mb-0.5">CRN</span>
                    <span className="font-mono font-bold text-slate-900 text-base">{sec.crn}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-200">
          <span className="text-sm font-semibold text-slate-600">Total Credits</span>
          <span className="font-bold text-slate-900 text-base">{totalCredits}</span>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="es-card p-5 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" /> Weekly Schedule
        </h2>
        <div className="overflow-x-auto">
          <div className="grid min-w-[520px]" style={{ gridTemplateColumns: '44px repeat(5, 1fr)' }}>
            {/* Day headers */}
            <div />
            {days.map(d => (
              <div key={d} className="text-center text-xs font-bold text-slate-500 py-2 border-b border-slate-200">
                {DAY_NAMES[d]}
              </div>
            ))}

            {/* Hour rows */}
            {hours.map(h => (
              <>
                <div key={`lbl-${h}`} className="text-[10px] text-slate-400 pr-2 text-right pt-0.5 leading-none border-b border-slate-50" style={{ height: 40 }}>
                  {h % 12 || 12}{h < 12 ? 'a' : 'p'}
                </div>
                {days.map(d => {
                  const blocks = (calGrid[d] ?? []).filter(b => {
                    const blockRowStart = b.rowStart
                    const rowIdx = (h - 7) * 2 + 1  // top half-hour row index for this hour
                    return blockRowStart >= rowIdx && blockRowStart < rowIdx + 2
                  })
                  return (
                    <div
                      key={`${d}-${h}`}
                      className="border-b border-l border-slate-100 relative"
                      style={{ height: 40 }}
                    >
                      {blocks.map((b, i) => (
                        <div
                          key={i}
                          className={`absolute left-0.5 right-0.5 rounded-md border text-[10px] font-bold px-1.5 py-0.5 overflow-hidden leading-tight ${b.color}`}
                          style={{
                            height: b.rowSpan * 20,
                            zIndex: 1,
                          }}
                        >
                          {b.code}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <p className="text-sm text-slate-500 mb-4">Want to build your own schedule?</p>
        <Link
          href="/schedule-builder"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <Calendar className="h-4 w-4" /> Try Schedule Builder <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
