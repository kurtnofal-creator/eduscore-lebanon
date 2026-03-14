'use client'

import { cn } from '@/lib/utils'
import { formatTime, DAYS_ORDER, DAY_LABELS } from '@/lib/schedule-engine'
import { getCourseColors } from '@/lib/schedule-colors'
import type { SectionData } from '@/lib/schedule-engine'

const START_HOUR = 7   // 7:00 AM
const END_HOUR = 22    // 10:00 PM
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60
const PIXEL_PER_MIN = 1.3  // px per minute of class time

const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
  const h = START_HOUR + i
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}${period}`
})

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

interface ScheduleCalendarProps {
  sections: SectionData[]
  /** Ordered course IDs so colors stay consistent with the left-panel chips */
  courseIds?: string[]
}

export function ScheduleCalendar({ sections, courseIds }: ScheduleCalendarProps) {
  // Determine which days to show (only days with actual meetings)
  const usedDays = new Set(sections.flatMap(s => s.meetings.map(m => m.day)))
  const visibleDays = DAYS_ORDER.filter(d => usedDays.has(d))

  if (visibleDays.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No meeting times available for this schedule.
      </div>
    )
  }

  // Build color-index map: courseId → palette index
  // Use courseIds prop order when provided (consistent with left-panel chips)
  const colorIndexMap = new Map<string, number>()
  if (courseIds && courseIds.length > 0) {
    courseIds.forEach((id, i) => colorIndexMap.set(id, i))
    // Assign any courses not in courseIds (shouldn't happen, but defensive)
    sections.forEach(s => {
      if (!colorIndexMap.has(s.courseId)) {
        colorIndexMap.set(s.courseId, colorIndexMap.size)
      }
    })
  } else {
    // Fallback: assign by order of first appearance
    sections.forEach(s => {
      if (!colorIndexMap.has(s.courseId)) {
        colorIndexMap.set(s.courseId, colorIndexMap.size)
      }
    })
  }

  const GRID_HEIGHT = TOTAL_MINS * PIXEL_PER_MIN

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">

        {/* Header row */}
        <div className="flex border-b border-slate-100">
          <div className="w-14 flex-shrink-0" />
          {visibleDays.map(day => (
            <div key={day} className="flex-1 py-2 text-center text-xs font-semibold text-slate-500 border-l border-slate-100 uppercase tracking-wide">
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex">
          {/* Time labels */}
          <div className="w-14 flex-shrink-0 relative" style={{ height: GRID_HEIGHT }}>
            {HOUR_LABELS.map((label, i) => (
              <div
                key={label}
                className="absolute right-2 text-[10px] text-slate-400 -translate-y-2 select-none"
                style={{ top: i * 60 * PIXEL_PER_MIN }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {visibleDays.map(day => {
            const dayMeetings = sections.flatMap(section =>
              section.meetings
                .filter(m => m.day === day)
                .map(m => ({ ...m, section }))
            )

            return (
              <div
                key={day}
                className="flex-1 border-l border-slate-100 relative"
                style={{ height: GRID_HEIGHT }}
              >
                {/* Hour grid lines */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute left-0 right-0 border-t',
                      i % 2 === 0 ? 'border-slate-100' : 'border-slate-50'
                    )}
                    style={{ top: i * 60 * PIXEL_PER_MIN }}
                  />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={`half-${i}`}
                    className="absolute left-0 right-0 border-t border-dashed border-slate-50"
                    style={{ top: (i * 60 + 30) * PIXEL_PER_MIN }}
                  />
                ))}

                {/* Meeting blocks */}
                {dayMeetings.map((item, idx) => {
                  const startMins = toMinutes(item.startTime) - START_HOUR * 60
                  const endMins = toMinutes(item.endTime) - START_HOUR * 60
                  const top = startMins * PIXEL_PER_MIN
                  const height = Math.max(24, (endMins - startMins) * PIXEL_PER_MIN)
                  const colorIdx = colorIndexMap.get(item.section.courseId) ?? 0
                  const colors = getCourseColors(colorIdx)
                  const profLastName = item.section.professors[0]?.fullName.split(' ').pop() ?? null
                  const room = item.location ?? item.section.location ?? null

                  return (
                    <div
                      key={`${item.section.id}-${idx}`}
                      className={cn(
                        'absolute left-0.5 right-0.5 rounded-lg border-l-[3px] px-1.5 py-1 overflow-hidden shadow-sm',
                        colors.block
                      )}
                      style={{ top, height }}
                      title={[
                        `${item.section.courseCode} §${item.section.sectionNumber}`,
                        item.section.courseName,
                        `${formatTime(item.startTime)} – ${formatTime(item.endTime)}`,
                        profLastName ? `Prof. ${profLastName}` : null,
                        room ? `Room: ${room}` : null,
                        item.section.crn ? `CRN: ${item.section.crn}` : null,
                      ].filter(Boolean).join('\n')}
                    >
                      {/* Course code — always visible */}
                      <div className="font-bold text-[11px] leading-tight truncate">
                        {item.section.courseCode}
                        <span className="font-normal opacity-60 ml-1">§{item.section.sectionNumber}</span>
                      </div>

                      {/* Time range — if block is tall enough */}
                      {height > 30 && (
                        <div className="text-[10px] opacity-70 leading-tight truncate">
                          {formatTime(item.startTime)}–{formatTime(item.endTime)}
                        </div>
                      )}

                      {/* Professor last name — if block is tall enough */}
                      {height > 50 && profLastName && (
                        <div className="text-[10px] opacity-60 leading-tight truncate">
                          {profLastName}
                        </div>
                      )}

                      {/* Room — if block is tall enough */}
                      {height > 70 && room && (
                        <div className="text-[10px] opacity-50 leading-tight truncate">
                          {room}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
