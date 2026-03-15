/**
 * EduScore Lebanon – Schedule Builder Engine
 *
 * Generates all valid (conflict-free) schedule combinations from
 * a set of course sections, then ranks them by user preferences.
 */

export interface MeetingTime {
  day: string
  startTime: string  // "08:00"
  endTime: string    // "09:15"
  type: string
  location?: string | null
}

export interface SectionData {
  id: string
  sectionNumber: string
  courseId: string
  courseName: string
  courseCode: string
  professors: Array<{ id: string; fullName: string; overallRating: number | null; workloadLevel: number | null; confidence?: string }>
  meetings: MeetingTime[]
  location?: string | null
  crn?: string | null
  courseCredits?: number | null
  // Data quality & freshness
  status?: string | null          // OPEN | CLOSED | WAITLIST | UNKNOWN
  seatsRemaining?: number | null
  capacity?: number | null
  enrolled?: number | null
  isStale?: boolean
  completenessScore?: number | null
  dataQualityStatus?: string | null  // COMPLETE | PARTIAL | MINIMAL
  historicalInference?: boolean
  lastSyncedAt?: string | null
}

export interface ScheduleResult {
  sections: SectionData[]
  score: number
  scoreReasons: string[]  // human-readable score breakdown labels
  metrics: {
    avgProfRating: number
    avgWorkload: number
    daysOnCampus: number
    longestGap: number   // minutes
    totalGap: number     // minutes
    earliestStart: string
    latestEnd: string
    hasConflict: boolean
  }
}

export type SchedulePreference =
  | 'best_professors'
  | 'light_workload'
  | 'fewer_days'
  | 'short_gaps'
  | 'early_start'
  | 'late_start'
  | 'balanced'

// Convert "HH:MM" to minutes from midnight for arithmetic
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Check if two meeting blocks overlap
function meetingsOverlap(a: MeetingTime, b: MeetingTime): boolean {
  if (a.day !== b.day) return false
  const aStart = toMinutes(a.startTime)
  const aEnd = toMinutes(a.endTime)
  const bStart = toMinutes(b.startTime)
  const bEnd = toMinutes(b.endTime)
  return aStart < bEnd && bStart < aEnd
}

// Check if two sections conflict in time
function sectionsConflict(a: SectionData, b: SectionData): boolean {
  for (const meetA of a.meetings) {
    for (const meetB of b.meetings) {
      if (meetingsOverlap(meetA, meetB)) return true
    }
  }
  return false
}

/**
 * Build a ScheduleResult from an already-chosen set of sections.
 * Used by the share-URL resolve endpoint to reconstruct a saved schedule.
 */
export function computeScheduleResult(
  sections: SectionData[],
  preference: SchedulePreference = 'balanced'
): ScheduleResult {
  const metrics = computeMetrics(sections)
  const { score, reasons } = scoreSchedule(metrics, preference, sections)
  return { sections, score, scoreReasons: reasons, metrics }
}

// Compute metrics for a completed schedule
function computeMetrics(sections: SectionData[]): ScheduleResult['metrics'] {
  const allMeetings = sections.flatMap(s => s.meetings)

  // Days on campus
  const uniqueDays = new Set(allMeetings.map(m => m.day))
  const daysOnCampus = uniqueDays.size

  // Per-day start/end times for gap calculation
  const byDay: Record<string, number[]> = {}
  for (const m of allMeetings) {
    if (!byDay[m.day]) byDay[m.day] = []
    byDay[m.day].push(toMinutes(m.startTime), toMinutes(m.endTime))
  }

  let longestGap = 0
  let totalGap = 0
  for (const day of Object.keys(byDay)) {
    const times = [...new Set(byDay[day])].sort((a, b) => a - b)
    for (let i = 0; i < times.length - 1; i += 2) {
      // gap between end of one class and start of next (on same day)
    }
    // simplified: gap between earliest end and latest start in windows
    const meetings = sections
      .flatMap(s => s.meetings.filter(m => m.day === day))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

    for (let i = 0; i < meetings.length - 1; i++) {
      const gap = toMinutes(meetings[i + 1].startTime) - toMinutes(meetings[i].endTime)
      if (gap > 0) {
        totalGap += gap
        if (gap > longestGap) longestGap = gap
      }
    }
  }

  const allStarts = allMeetings.map(m => m.startTime).sort()
  const allEnds = allMeetings.map(m => m.endTime).sort()
  const earliestStart = allStarts[0] ?? '08:00'
  const latestEnd = allEnds[allEnds.length - 1] ?? '17:00'

  // Average professor rating
  const ratings = sections.flatMap(s =>
    s.professors.map(p => p.overallRating).filter((r): r is number => r !== null)
  )
  const avgProfRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

  const workloads = sections.flatMap(s =>
    s.professors.map(p => p.workloadLevel).filter((w): w is number => w !== null)
  )
  const avgWorkload = workloads.length ? workloads.reduce((a, b) => a + b, 0) / workloads.length : 3

  return {
    avgProfRating,
    avgWorkload,
    daysOnCampus,
    longestGap,
    totalGap,
    earliestStart,
    latestEnd,
    hasConflict: false,
  }
}

// Score a schedule based on user preferences
// sections param used to compute confidence bonus (tiebreaker: CONFIRMED > INFERRED)
function scoreSchedule(
  metrics: ScheduleResult['metrics'],
  preference: SchedulePreference,
  sections: SectionData[]
): { score: number; reasons: string[] } {
  const { avgProfRating, avgWorkload, daysOnCampus, totalGap, earliestStart, latestEnd } = metrics
  const startMins = toMinutes(earliestStart)
  const endMins = toMinutes(latestEnd)

  // Confidence bonus: each CONFIRMED professor assignment adds 0.5 (tiebreaker only)
  const confirmedCount = sections.reduce(
    (acc, s) => acc + s.professors.filter(p => p.confidence === 'CONFIRMED').length,
    0
  )
  const confidenceBonus = confirmedCount * 0.5

  let base: number
  switch (preference) {
    case 'best_professors':
      base = avgProfRating * 20; break

    case 'light_workload':
      base = (5 - avgWorkload) * 20; break

    case 'fewer_days':
      base = (7 - daysOnCampus) * 15; break

    case 'short_gaps':
      base = Math.max(0, 100 - totalGap / 10); break

    case 'early_start':
      base = Math.max(0, 100 - (endMins - 8 * 60) / 5); break

    case 'late_start':
      base = (startMins - 8 * 60) / 5; break

    case 'balanced':
    default:
      base = (
        avgProfRating * 10 +
        (5 - avgWorkload) * 8 +
        (7 - daysOnCampus) * 6 +
        Math.max(0, 50 - totalGap / 20)
      )
  }

  // Build human-readable reason labels
  const reasons: string[] = []
  if (avgProfRating > 0) {
    reasons.push(`★ ${avgProfRating.toFixed(1)} avg prof`)
  }
  if (daysOnCampus === 1) reasons.push('1 campus day')
  else if (daysOnCampus <= 3) reasons.push(`${daysOnCampus} campus days`)
  else reasons.push(`${daysOnCampus} days/wk`)

  if (totalGap === 0) reasons.push('no gaps')
  else if (totalGap <= 60) reasons.push(`${totalGap}min gap`)

  if (avgWorkload > 0 && avgWorkload <= 2.5) reasons.push('light workload')
  else if (avgWorkload >= 4.5) reasons.push('heavy workload')

  if (confirmedCount === sections.length && sections.length > 0) reasons.push('all confirmed')
  else if (confirmedCount > 0) reasons.push(`${confirmedCount} confirmed`)

  return { score: base + confidenceBonus, reasons }
}

/**
 * Main schedule generation function.
 *
 * @param courseOptions  Map of courseId → list of available sections
 * @param preference     Ranking preference
 * @param maxResults     Maximum schedules to return (default 20)
 */
export function generateSchedules(
  courseOptions: Map<string, SectionData[]>,
  preference: SchedulePreference = 'balanced',
  maxResults = 20
): ScheduleResult[] {
  const coursesArray = Array.from(courseOptions.entries())

  if (coursesArray.length === 0) return []

  const results: ScheduleResult[] = []

  // Recursive backtracking schedule builder
  function build(index: number, chosen: SectionData[]): void {
    if (index === coursesArray.length) {
      const metrics = computeMetrics(chosen)
      const { score, reasons } = scoreSchedule(metrics, preference, chosen)
      results.push({ sections: [...chosen], score, scoreReasons: reasons, metrics })
      return
    }

    const [, sections] = coursesArray[index]

    for (const section of sections) {
      // Check against all already-chosen sections
      let conflict = false
      for (const existing of chosen) {
        if (sectionsConflict(section, existing)) {
          conflict = true
          break
        }
      }

      if (!conflict) {
        chosen.push(section)
        build(index + 1, chosen)
        chosen.pop()

        // Early exit if we have enough results (performance guard for large inputs)
        if (results.length >= maxResults * 10) return
      }
    }
  }

  build(0, [])

  // Sort by score descending, return top N
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

/**
 * Validate that a manually constructed schedule has no conflicts.
 */
export function validateSchedule(sections: SectionData[]): {
  valid: boolean
  conflicts: Array<{ a: string; b: string; day: string; time: string }>
} {
  const conflicts: Array<{ a: string; b: string; day: string; time: string }> = []

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      for (const mA of sections[i].meetings) {
        for (const mB of sections[j].meetings) {
          if (meetingsOverlap(mA, mB)) {
            conflicts.push({
              a: `${sections[i].courseCode} §${sections[i].sectionNumber}`,
              b: `${sections[j].courseCode} §${sections[j].sectionNumber}`,
              day: mA.day,
              time: `${mA.startTime}–${mA.endTime}`,
            })
          }
        }
      }
    }
  }

  return { valid: conflicts.length === 0, conflicts }
}

/**
 * Format a time string for display: "08:00" → "8:00 AM"
 */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

export const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
export const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
}
