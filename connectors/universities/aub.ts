/**
 * AUB Connector – American University of Beirut
 *
 * FROZEN: 2026-03-12 — Parsing logic is stable. Do not modify without review.
 * Baseline (Spring 2026 / 202620): 3435 sections, 96 subjects, 1540 courses, 809 professors.
 *
 * Data pipeline (in priority order):
 *
 *  1. www-banner.aub.edu.lb/catalog/schd_[A-Z].htm  (primary)
 *     Fully public, no auth, updated each term by AUB Registrar.
 *     Contains: CRN, subject, code, section, title, credits, enrollment,
 *     seat availability, meeting times, building/room, instructor name.
 *     All assignments extracted here are marked CONFIRMED.
 *
 *  2. Disk cache — used when live fetch fails (protects against temporary outages).
 *     Cached data is marked isPartial=true to signal freshness uncertainty.
 *     TTL: 24 hours.
 *
 *  3. Banner 9 SSB (sturegss.aub.edu.lb) — requires campus network access.
 *     Used if the static pages are temporarily unavailable.
 *
 *  4. Structured fallback — representative catalog data, historicalInference = true.
 *
 * AUB term code convention (academic year):
 *   202620 = Spring 2025-2026  (calendar spring 2026)
 *   202630 = Summer 2025-2026
 *   202610 = Fall 2025-2026
 *   202510 = Fall 2024-2025
 */

import * as cheerio from 'cheerio'
import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join } from 'path'
import { BaseConnector } from '../base'
import {
  ConnectorConfig, ConnectorResult, ConnectorSection,
  scoreCompleteness, qualityFromScore,
} from '../types'

const CACHE_DIR = join(process.cwd(), 'tmp', 'connector-cache')
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

const CATALOG_BASE = 'https://www-banner.aub.edu.lb/catalog'
const CATALOG_INDEX = `${CATALOG_BASE}/schedule_header.html`

// Map our internal term codes → AUB 6-digit Banner term codes
const TERM_MAP: Record<string, string> = {
  'FALL-2024':   '202510',  // Fall 2024-2025
  'SPRING-2025': '202520',  // Spring 2024-2025 (AUB uses academic year naming)
  'SUMMER-2025': '202530',
  'FALL-2025':   '202610',  // Fall 2025-2026
  'SPRING-2026': '202620',  // Spring 2025-2026 (most current as of 2026-03)
  'SUMMER-2026': '202630',
}

// Day columns in the HTML table (slots 1 and 2 each have 6 day cells)
// Header shows "S C H E D U" but values are M/T/W/R/F/S for the active day
const DAY_COL_MAP = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

// Column indices in the data table
const COL = {
  TERM:       0,
  CRN:        1,
  SUBJECT:    2,
  CODE:       3,
  SECTION:    4,
  TITLE:      5,
  CREDITS:    6,
  ENROLLED:   9,
  SEATS:      10,
  BEGIN1:     11,
  END1:       12,
  BUILDING1:  13,
  ROOM1:      14,
  DAYS1:      15,  // 15–20 inclusive (6 day columns)
  LE1:        21,  // meeting type slot 1
  BEGIN2:     22,
  END2:       23,
  BUILDING2:  24,
  ROOM2:      25,
  DAYS2:      26,  // 26–31 inclusive (6 day columns)
  LE2:        32,  // meeting type slot 2
  INST_FIRST: 33,
  INST_LAST:  34,
  LINKED_CRN: 35,
} as const

// Banner 9 SSB (requires campus network)
const SSB_BASE = 'https://sturegss.aub.edu.lb/StudentRegistrationSsb/ssb'
const SSB_SEARCH = `${SSB_BASE}/courseSearchResults/courseSearchResults`

interface BannerSection {
  courseReferenceNumber: string
  subject: string
  courseNumber: string
  courseTitle: string
  sequenceNumber: string
  seatsAvailable: number
  maximumEnrollment: number
  enrollment: number
  faculty: Array<{ displayName: string }>
  meetingsFaculty: Array<{
    meetingTime: {
      monday: boolean; tuesday: boolean; wednesday: boolean
      thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean
      beginTime: string; endTime: string; room: string; building: string
      meetingType: string
    }
  }>
}

interface BannerResponse {
  data: BannerSection[]
  totalCount: number
}

export class AUBConnector extends BaseConnector {
  readonly name = 'aub-catalog'
  readonly universitySlug = 'aub'

  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const termCode = config.termCode ?? 'SPRING-2026'
    const errors: string[] = []
    let sections: ConnectorSection[] = []

    // ── Attempt 1: Public catalog HTML pages (no auth, fully public) ──
    try {
      sections = await this.fetchFromCatalog(termCode)
      if (sections.length > 0) {
        await this.writeCache(termCode, sections)
        return {
          universitySlug: 'aub', termCode, sections,
          fetchedAt: new Date(), isPartial: false, errors,
        }
      }
      errors.push('Catalog returned 0 sections for this term — may not be published yet')
    } catch (err) {
      errors.push(`Catalog fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Attempt 1b: Disk cache (protects against temporary source outages) ──
    try {
      const cached = await this.readCache(termCode)
      if (cached) {
        errors.push('Using cached catalog data — live source temporarily unavailable')
        return {
          universitySlug: 'aub', termCode, sections: cached,
          fetchedAt: new Date(), isPartial: true, errors,
        }
      }
    } catch { /* cache miss is non-fatal */ }

    // ── Attempt 2: Banner 9 SSB (campus-network only) ──────────────────
    try {
      sections = await this.fetchFromBannerSSB(termCode)
      if (sections.length > 0) {
        return {
          universitySlug: 'aub', termCode, sections,
          fetchedAt: new Date(), isPartial: false, errors,
        }
      }
    } catch (err) {
      errors.push(`Banner SSB fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Attempt 3: Structured fallback ──────────────────────────────────
    sections = this.structuredFallback(termCode)
    errors.push('Using structured fallback data — live enrollment unavailable')
    return { universitySlug: 'aub', termCode, sections, fetchedAt: new Date(), isPartial: true, errors }
  }

  // ── Primary: public catalog scraper ────────────────────────────────────────

  private async fetchFromCatalog(termCode: string): Promise<ConnectorSection[]> {
    const targetBannerTerm = TERM_MAP[termCode]
    if (!targetBannerTerm) throw new Error(`No term mapping for ${termCode}`)

    // Fetch the index to confirm which terms are available
    const indexRes = await this.fetchUrl(CATALOG_INDEX, {}, 15_000)
    if (!indexRes.ok) throw new Error(`Catalog index HTTP ${indexRes.status}`)
    const indexHtml = await indexRes.text()
    const availableTerms = this.parseAvailableTerms(indexHtml)

    if (!availableTerms.includes(targetBannerTerm)) {
      if (availableTerms.length === 0) throw new Error('No terms available in catalog')
      throw new Error(
        `Term ${targetBannerTerm} not in catalog (available: ${availableTerms.join(', ')}). ` +
        `Update your sync term code to one of the available terms.`
      )
    }

    // Fetch all 26 letter pages in parallel (batched to avoid overwhelming the server)
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const sections: ConnectorSection[] = []

    // Batch of 5 concurrent fetches
    for (let i = 0; i < letters.length; i += 5) {
      const batch = letters.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(letter =>
          this.fetchLetterPage(letter, targetBannerTerm)
        )
      )
      for (const r of results) {
        if (r.status === 'fulfilled') sections.push(...r.value)
      }
    }

    return sections
  }

  private parseAvailableTerms(html: string): string[] {
    // The header page contains lines like "202630:Summer 2025-2026."
    const matches = [...html.matchAll(/(\d{6}):/g)]
    return matches.map(m => m[1])
  }

  private async fetchLetterPage(
    letter: string,
    bannerTerm: string
  ): Promise<ConnectorSection[]> {
    const url = `${CATALOG_BASE}/schd_${letter}.htm`
    const res = await this.fetchUrl(url, {}, 30_000)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const html = await res.text()
    return this.parseCatalogPage(html, bannerTerm)
  }

  private parseCatalogPage(html: string, bannerTerm: string): ConnectorSection[] {
    const $ = cheerio.load(html)
    const sections: ConnectorSection[] = []

    // The data table is the second TABLE on the page (first is the header banner)
    const tables = $('table')
    if (tables.length < 2) return sections

    const dataTable = tables.eq(1)
    const rows = dataTable.find('tr')

    // Skip the first two rows (title row + header row)
    rows.slice(2).each((_i, tr) => {
      const cells = $(tr).find('td')
      if (cells.length < 35) return  // incomplete row

      const cell = (idx: number) => $(cells[idx]).text().trim()

      // Filter by term — extract 6-digit code from "Spring 2025-2026(202620)"
      const termMatch = cell(COL.TERM).match(/\((\d{6})\)/)
      if (!termMatch || termMatch[1] !== bannerTerm) return

      const crn = cell(COL.CRN)
      const subject = cell(COL.SUBJECT)
      const code = cell(COL.CODE)
      const sectionNum = cell(COL.SECTION)
      const title = cell(COL.TITLE)

      if (!crn || !subject || !code) return

      const enrolled = parseInt(cell(COL.ENROLLED)) || undefined
      const seatsAvail = parseInt(cell(COL.SEATS))
      const seatsRemaining = isNaN(seatsAvail) ? undefined : seatsAvail
      const status = seatsRemaining == null ? 'UNKNOWN' : seatsRemaining > 0 ? 'OPEN' : 'CLOSED'

      // Extract day cell values for both meeting slots
      const days1 = Array.from({ length: 6 }, (_, d) => $(cells[COL.DAYS1 + d]).text().trim())
      const le1 = $(cells[COL.LE1]).text().trim()
      const days2 = Array.from({ length: 6 }, (_, d) => $(cells[COL.DAYS2 + d]).text().trim())
      const le2 = $(cells[COL.LE2]).text().trim()

      const meetings = [
        ...this.parseMeetingSlot(cell(COL.BEGIN1), cell(COL.END1), cell(COL.BUILDING1), cell(COL.ROOM1), days1, le1),
        ...this.parseMeetingSlot(cell(COL.BEGIN2), cell(COL.END2), cell(COL.BUILDING2), cell(COL.ROOM2), days2, le2),
      ]

      // Instructor
      const firstName = cell(COL.INST_FIRST)
      const lastName  = cell(COL.INST_LAST)
      const instructors: string[] = []
      if (firstName && firstName !== '.' && lastName && lastName !== '.') {
        instructors.push(`${firstName} ${lastName}`.trim())
      }

      const section: ConnectorSection = {
        sourceIdentifier: crn,
        courseCode: `${subject} ${code}`,
        courseName: title,
        sectionNumber: sectionNum,
        instructors,
        meetings,
        capacity: enrolled != null && seatsRemaining != null
          ? enrolled + seatsRemaining
          : undefined,
        enrolled,
        seatsRemaining,
        status: status as ConnectorSection['status'],
        sourceConnector: this.name,
        historicalInference: false,
        professorConfidence: instructors.length > 0 ? 'CONFIRMED' : 'INFERRED',
        completenessScore: 0,
        dataQualityStatus: 'PARTIAL',
      }

      section.completenessScore = scoreCompleteness(section)
      section.dataQualityStatus = qualityFromScore(section.completenessScore)
      sections.push(section)
    })

    return sections
  }

  private parseMeetingSlot(
    beginTime: string,
    endTime: string,
    building: string,
    room: string,
    dayValues: string[],   // 6 pre-extracted day cell texts
    leType: string,        // pre-extracted meeting type cell text
  ): ConnectorSection['meetings'] {
    if (!beginTime || beginTime === '.' || !endTime || endTime === '.') return []

    const startTime = this.parseAUBTime(beginTime)
    const endTimeParsed = this.parseAUBTime(endTime)
    if (!startTime || !endTimeParsed) return []

    const location = [building, room].filter(v => v && v !== '.').join(' ') || undefined
    const meetingType = leType && leType !== '.' ? leType : 'LECTURE'

    const meetings: ConnectorSection['meetings'] = []

    for (let d = 0; d < 6; d++) {
      const dayCell = dayValues[d] ?? ''
      if (!dayCell || dayCell === '.') continue
      meetings.push({
        day: DAY_COL_MAP[d],
        startTime,
        endTime: endTimeParsed,
        type: meetingType,
        location,
      })
    }

    return meetings
  }

  // AUB catalog time format: "0930" → "09:30"
  private parseAUBTime(t: string): string | null {
    if (!t || t === '.' || t.length < 3) return null
    const padded = t.padStart(4, '0')
    const h = padded.slice(0, 2)
    const m = padded.slice(2, 4)
    return `${h}:${m}`
  }

  // ── Fallback: Banner 9 SSB (campus network only) ────────────────────────────

  private async fetchFromBannerSSB(termCode: string): Promise<ConnectorSection[]> {
    const bannerTerm = TERM_MAP[termCode]
    if (!bannerTerm) throw new Error(`No term mapping for ${termCode}`)

    await this.fetchUrl(`${SSB_BASE}/term/search?mode=courseSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `term=${bannerTerm}`,
    }, 10_000)

    const sections: ConnectorSection[] = []
    let offset = 0
    const pageSize = 500

    while (true) {
      const url = `${SSB_SEARCH}?txt_term=${bannerTerm}&pageOffset=${offset}&pageMaxSize=${pageSize}&sortColumn=subjectDescription&sortDirection=asc`
      const data = await this.fetchJson<BannerResponse>(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      for (const s of data.data ?? []) {
        sections.push(this.normalizeBannerSection(s))
      }

      if (sections.length >= data.totalCount || (data.data ?? []).length < pageSize) break
      offset += pageSize
    }

    return sections
  }

  private normalizeBannerSection(s: BannerSection): ConnectorSection {
    const meetings: ConnectorSection['meetings'] = []
    for (const mf of s.meetingsFaculty ?? []) {
      const mt = mf.meetingTime
      const days: Array<[boolean, string]> = [
        [mt.monday, 'MONDAY'], [mt.tuesday, 'TUESDAY'], [mt.wednesday, 'WEDNESDAY'],
        [mt.thursday, 'THURSDAY'], [mt.friday, 'FRIDAY'],
        [mt.saturday, 'SATURDAY'], [mt.sunday, 'SUNDAY'],
      ]
      for (const [active, day] of days) {
        if (active && mt.beginTime && mt.endTime) {
          meetings.push({
            day,
            startTime: this.normalizeTime(mt.beginTime),
            endTime: this.normalizeTime(mt.endTime),
            type: mt.meetingType ?? 'LECTURE',
            location: [mt.building, mt.room].filter(Boolean).join(' ') || undefined,
          })
        }
      }
    }

    const seatsRemaining = s.seatsAvailable ?? (s.maximumEnrollment - s.enrollment)
    const status = seatsRemaining > 0 ? 'OPEN' : seatsRemaining === 0 ? 'CLOSED' : 'UNKNOWN'
    const instructors = (s.faculty ?? []).map(f => f.displayName).filter(Boolean)

    const section: ConnectorSection = {
      sourceIdentifier: s.courseReferenceNumber,
      courseCode: `${s.subject} ${s.courseNumber}`,
      courseName: s.courseTitle,
      sectionNumber: s.sequenceNumber,
      instructors,
      meetings,
      capacity: s.maximumEnrollment,
      enrolled: s.enrollment,
      seatsRemaining,
      status: status as ConnectorSection['status'],
      sourceConnector: this.name,
      historicalInference: false,
      professorConfidence: instructors.length > 0 ? 'CONFIRMED' : 'INFERRED',
      completenessScore: 0,
      dataQualityStatus: 'PARTIAL',
    }

    section.completenessScore = scoreCompleteness(section)
    section.dataQualityStatus = qualityFromScore(section.completenessScore)
    return section
  }

  // ── Structured fallback ─────────────────────────────────────────────────────

  private structuredFallback(termCode: string): ConnectorSection[] {
    const COURSES = [
      { code: 'CMPS 200', name: 'Introduction to Computing', sections: ['1', '2', '3'] },
      { code: 'CMPS 201', name: 'Programming Concepts', sections: ['1', '2'] },
      { code: 'CMPS 202', name: 'Data Structures', sections: ['1', '2', '3'] },
      { code: 'CMPS 211', name: 'Digital Design', sections: ['1'] },
      { code: 'CMPS 278', name: 'Machine Learning', sections: ['1'] },
      { code: 'CMPS 350', name: 'Operating Systems', sections: ['1', '2'] },
      { code: 'MATH 201', name: 'Calculus I', sections: ['1', '2', '3', '4'] },
      { code: 'MATH 202', name: 'Calculus II', sections: ['1', '2', '3'] },
      { code: 'MATH 218', name: 'Discrete Mathematics', sections: ['1', '2'] },
      { code: 'EECE 230', name: 'Circuits I', sections: ['1', '2'] },
      { code: 'EECE 350', name: 'Signals and Systems', sections: ['1'] },
      { code: 'MECH 210', name: 'Engineering Mechanics', sections: ['1', '2'] },
      { code: 'CHEM 101', name: 'General Chemistry I', sections: ['1', '2', '3'] },
      { code: 'PHYS 201', name: 'General Physics I', sections: ['1', '2', '3'] },
      { code: 'BIOL 201', name: 'General Biology', sections: ['1', '2'] },
      { code: 'ECON 211', name: 'Principles of Economics', sections: ['1', '2', '3'] },
      { code: 'MANG 201', name: 'Principles of Management', sections: ['1', '2'] },
      { code: 'ENGL 203', name: 'Introduction to Literature', sections: ['1', '2', '3'] },
    ]

    const PATTERNS = [
      { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '08:00', end: '08:50' },
      { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '10:00', end: '10:50' },
      { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '11:00', end: '11:50' },
      { days: ['TUESDAY', 'THURSDAY'], start: '09:00', end: '10:15' },
      { days: ['TUESDAY', 'THURSDAY'], start: '11:00', end: '12:15' },
      { days: ['TUESDAY', 'THURSDAY'], start: '14:00', end: '15:15' },
      { days: ['MONDAY', 'WEDNESDAY'], start: '13:00', end: '14:15' },
    ]

    const sections: ConnectorSection[] = []
    let idx = 0

    for (const course of COURSES) {
      for (const secNum of course.sections) {
        const pattern = PATTERNS[idx % PATTERNS.length]
        idx++

        const section: ConnectorSection = {
          sourceIdentifier: `AUB-${termCode}-${course.code.replace(' ', '')}-${secNum}`,
          courseCode: course.code,
          courseName: course.name,
          sectionNumber: secNum,
          instructors: [],
          meetings: pattern.days.map(day => ({
            day,
            startTime: pattern.start,
            endTime: pattern.end,
            type: 'LECTURE' as const,
            location: `West Hall ${100 + (idx % 20)}`,
          })),
          capacity: 35,
          enrolled: undefined,
          seatsRemaining: undefined,
          status: 'UNKNOWN',
          sourceConnector: this.name,
          historicalInference: true,
          professorConfidence: 'INFERRED',
          completenessScore: 0,
          dataQualityStatus: 'MINIMAL',
        }

        section.completenessScore = scoreCompleteness(section)
        section.dataQualityStatus = qualityFromScore(section.completenessScore)
        sections.push(section)
      }
    }

    return sections
  }

  // ── Disk cache ──────────────────────────────────────────────────────────────

  private cachePath(termCode: string): string {
    return join(CACHE_DIR, `aub-${termCode}.json`)
  }

  private async readCache(termCode: string): Promise<ConnectorSection[] | null> {
    try {
      const filePath = this.cachePath(termCode)
      const fileStat = await stat(filePath)
      if (Date.now() - fileStat.mtimeMs > CACHE_TTL_MS) return null
      const raw = await readFile(filePath, 'utf-8')
      return JSON.parse(raw) as ConnectorSection[]
    } catch {
      return null
    }
  }

  private async writeCache(termCode: string, sections: ConnectorSection[]): Promise<void> {
    try {
      await mkdir(CACHE_DIR, { recursive: true })
      await writeFile(this.cachePath(termCode), JSON.stringify(sections))
    } catch {
      // Non-fatal — cache write failure does not affect the sync result
    }
  }
}
