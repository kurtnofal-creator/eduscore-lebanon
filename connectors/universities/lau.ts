/**
 * LAU Connector – Lebanese American University
 *
 * FROZEN: 2026-03-12 — Parsing logic is stable. Do not modify without review.
 * Baseline (Spring 2026 / 202620): ~2000+ sections, confirmed professor assignments.
 *
 * Data pipeline:
 *
 *  1. banweb.lau.edu.lb/prod/bwckschd.p_get_crse_unsec  (Banner 8, fully public)
 *     POST with sel_subj=% returns all sections for a term — no authentication required.
 *     Contains: CRN, course name, subject, code, section, meeting times, days, room,
 *     instructor name. Enrollment/seat data is not available from this endpoint.
 *     All instructor names extracted here are marked CONFIRMED.
 *
 *  2. Disk cache — used when live fetch fails (protects against temporary outages).
 *     Cached data is marked isPartial=true to signal freshness uncertainty. TTL: 24h.
 *
 *  3. Structured fallback — representative catalog data, historicalInference = true.
 *
 * Banner 8 day encoding: M=Mon T=Tue W=Wed R=Thu F=Fri S=Sat
 * Time format: "9:00 am - 9:50 am"
 *
 * LAU term codes:
 *   202620 = Spring 2026  (current as of 2026-03)
 *   202610 = Fall 2025
 *   202530 = Summer 2025
 *   202520 = Spring 2025
 *   202510 = Fall 2024
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

const BANWEB       = 'https://banweb.lau.edu.lb/prod'
const SCHEDULE_URL = `${BANWEB}/bwckschd.p_get_crse_unsec`
const TERMS_URL    = `${BANWEB}/bwckschd.p_disp_dyn_sched`

// Internal term code → LAU Banner 6-digit term code
const TERM_MAP: Record<string, string> = {
  'FALL-2024':   '202510',
  'SPRING-2025': '202520',
  'SUMMER-2025': '202530',
  'FALL-2025':   '202610',
  'SPRING-2026': '202620',
  'SUMMER-2026': '202630',
  'FALL-2026':   '202710',
}

// Banner 8 single-character day codes → normalized names
const BANNER_DAY: Record<string, string> = {
  M: 'MONDAY',
  T: 'TUESDAY',
  W: 'WEDNESDAY',
  R: 'THURSDAY',
  F: 'FRIDAY',
  S: 'SATURDAY',
}

export class LAUConnector extends BaseConnector {
  readonly name = 'lau-banner8'
  readonly universitySlug = 'lau'

  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const termCode = config.termCode ?? 'SPRING-2026'
    const errors: string[] = []

    // ── Attempt 1: Banner 8 public class schedule ─────────────────────────
    try {
      const sections = await this.fetchFromBanner8(termCode)
      if (sections.length > 0) {
        await this.writeCache(termCode, sections)
        return {
          universitySlug: 'lau', termCode, sections,
          fetchedAt: new Date(), isPartial: false, errors,
        }
      }
      errors.push('Banner 8 returned 0 sections for this term')
    } catch (err) {
      errors.push(`Banner 8 fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Attempt 1b: Disk cache (protects against temporary source outages) ──
    try {
      const cached = await this.readCache(termCode)
      if (cached) {
        errors.push('Using cached schedule data — live source temporarily unavailable')
        return {
          universitySlug: 'lau', termCode, sections: cached,
          fetchedAt: new Date(), isPartial: true, errors,
        }
      }
    } catch { /* cache miss is non-fatal */ }

    // ── Attempt 2: Structured fallback ────────────────────────────────────
    const sections = this.structuredFallback(termCode)
    errors.push('Using structured fallback data — live enrollment unavailable')
    return { universitySlug: 'lau', termCode, sections, fetchedAt: new Date(), isPartial: true, errors }
  }

  // ── Primary: Banner 8 public class schedule scraper ────────────────────────

  private async fetchFromBanner8(termCode: string): Promise<ConnectorSection[]> {
    const bannerTerm = TERM_MAP[termCode]
    if (!bannerTerm) throw new Error(`No Banner term mapping for ${termCode}`)

    // Check that the term exists (lightweight GET, also primes any Banner state)
    await this.verifyTerm(bannerTerm)

    // POST for all subjects — % wildcard returns the entire schedule in one response
    const body = this.buildScheduleBody(bannerTerm, '%')
    const res = await this.fetchUrl(SCHEDULE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }, 60_000)  // 60s timeout — full schedule HTML is ~4-5 MB

    if (!res.ok) throw new Error(`Banner 8 HTTP ${res.status}`)
    const html = await res.text()

    // Safety check: if a login page slipped through, bail
    if (html.includes('PD-S-SESSION-ID') || html.includes('Sign in | LAU')) {
      throw new Error('Banner 8 returned a login page — endpoint may now require authentication')
    }

    return this.parseBanner8Schedule(html)
  }

  private async verifyTerm(bannerTerm: string): Promise<void> {
    const res = await this.fetchUrl(TERMS_URL, {}, 10_000)
    if (!res.ok) return  // non-fatal
    const html = await res.text()
    if (!html.includes(bannerTerm)) {
      throw new Error(`Term ${bannerTerm} not listed in LAU Banner`)
    }
  }

  private buildScheduleBody(bannerTerm: string, subject: string): string {
    // Banner 8 requires a 'dummy' sentinel before each real multi-value field
    const params = new URLSearchParams([
      ['term_in',       bannerTerm],
      ['sel_subj',      'dummy'],
      ['sel_day',       'dummy'],
      ['sel_schd',      'dummy'],
      ['sel_insm',      'dummy'],
      ['sel_camp',      'dummy'],
      ['sel_levl',      'dummy'],
      ['sel_sess',      'dummy'],
      ['sel_instr',     'dummy'],
      ['sel_ptrm',      'dummy'],
      ['sel_attr',      'dummy'],
      ['sel_subj',      subject],     // % = all subjects
      ['sel_crse',      ''],
      ['sel_title',     ''],
      ['sel_schd',      '%'],
      ['sel_from_cred', ''],
      ['sel_to_cred',   ''],
      ['sel_camp',      '%'],
      ['sel_levl',      '%'],
      ['sel_ptrm',      '%'],
      ['sel_instr',     '%'],
      ['sel_attr',      '%'],
      ['begin_hh',      '0'],
      ['begin_mi',      '0'],
      ['begin_ap',      'a'],
      ['end_hh',        '0'],
      ['end_mi',        '0'],
      ['end_ap',        'a'],
    ])
    return params.toString()
  }

  private parseBanner8Schedule(html: string): ConnectorSection[] {
    const $ = cheerio.load(html)
    const sections: ConnectorSection[] = []

    // The outer "Sections Found" datadisplaytable wraps all section row-pairs
    const outerTable = $('table.datadisplaytable').filter((_i, el) =>
      ($(el).attr('summary') ?? '').toLowerCase().includes('sections found')
    ).first()

    if (!outerTable.length) return sections

    // Each section is a pair of consecutive rows:
    //   Row A: <th class="ddtitle"> — link with "Title - CRN - SUBJ NUM - SecNum"
    //   Row B: <td class="dddefault"> — metadata + nested meeting-times table
    const rows = outerTable.find('> tbody > tr, > tr').toArray()

    for (let i = 0; i < rows.length; i++) {
      const titleTh = $(rows[i]).find('th.ddtitle').first()
      if (!titleTh.length) continue

      const link      = titleTh.find('a').first()
      const href      = link.attr('href') ?? ''
      const titleText = link.text().trim()

      // CRN from href: ?term_in=202620&crn_in=20648
      const crnMatch = href.match(/crn_in=(\d+)/)
      if (!crnMatch) continue
      const crn = crnMatch[1]

      // Title format: "Course Name - CRN - SUBJ NUM - SectionNum"
      // Split from the right to handle course names that contain " - "
      const parts = titleText.split(' - ')
      if (parts.length < 4) continue
      const sectionNum = parts[parts.length - 1].trim()
      const courseCode = parts[parts.length - 2].trim()   // e.g. "CSC 201"
      const courseName = parts.slice(0, parts.length - 3).join(' - ').trim()

      // Row B: detail cell
      const detailTr = $(rows[i + 1])
      const detailTd = detailTr.find('td.dddefault').first()
      if (!detailTd.length) continue

      // Find the nested meeting-times table
      const meetingTable = detailTd.find('table.datadisplaytable').filter((_j, el) =>
        ($(el).attr('summary') ?? '').toLowerCase().includes('meeting times')
      ).first()

      const meetings: ConnectorSection['meetings'] = []
      const instructors: string[] = []

      meetingTable.find('tr').slice(1).each((_j, row) => {
        const cells = $(row).find('td.dddefault')
        if (cells.length < 7) return

        const timeStr  = $(cells[1]).text().trim()
        const daysStr  = $(cells[2]).text().trim()
        const whereStr = $(cells[3]).text().trim()
        const leType   = $(cells[5]).text().trim()
        const instrRaw = $(cells[6]).text().trim()

        // Strip "(P)" primary marker and extra whitespace from instructor
        const instrName = instrRaw.replace(/\([PE]\)/g, '').replace(/\s+/g, ' ').trim()
        if (instrName && instrName !== 'TBA' && !instructors.includes(instrName)) {
          instructors.push(instrName)
        }

        // Parse days: "MWF" → ["MONDAY","WEDNESDAY","FRIDAY"]
        const days = this.parseBanner8Days(daysStr)
        if (days.length === 0) return

        // Parse time: "9:00 am - 9:50 am"
        const [startTime, endTime] = this.parseBanner8Time(timeStr)
        if (!startTime || !endTime) return

        const location    = whereStr && whereStr !== 'TBA' ? whereStr : undefined
        const meetingType = leType   && leType   !== 'TBA' ? leType   : 'LECTURE'

        for (const day of days) {
          meetings.push({ day, startTime, endTime, type: meetingType, location })
        }
      })

      const section: ConnectorSection = {
        sourceIdentifier: crn,
        courseCode,
        courseName,
        sectionNumber: sectionNum,
        instructors,
        meetings,
        // Enrollment data not available from this public endpoint
        capacity:       undefined,
        enrolled:       undefined,
        seatsRemaining: undefined,
        status:         'UNKNOWN',
        sourceConnector:    this.name,
        historicalInference: false,
        professorConfidence: instructors.length > 0 ? 'CONFIRMED' : 'INFERRED',
        completenessScore:  0,
        dataQualityStatus:  'PARTIAL',
      }

      section.completenessScore = scoreCompleteness(section)
      section.dataQualityStatus = qualityFromScore(section.completenessScore)
      sections.push(section)
    }

    return sections
  }

  // "MWF" → ["MONDAY","WEDNESDAY","FRIDAY"],  "TR" → ["TUESDAY","THURSDAY"]
  private parseBanner8Days(dayStr: string): string[] {
    if (!dayStr || dayStr.trim() === 'TBA') return []
    const days: string[] = []
    for (const ch of dayStr.trim()) {
      const day = BANNER_DAY[ch]
      if (day && !days.includes(day)) days.push(day)
    }
    return days
  }

  // "9:00 am - 9:50 am" → ["09:00","09:50"]
  private parseBanner8Time(timeStr: string): [string | null, string | null] {
    if (!timeStr || timeStr.trim() === 'TBA') return [null, null]
    const parts = timeStr.split(' - ')
    if (parts.length < 2) return [null, null]
    return [this.normalizeTime(parts[0].trim()), this.normalizeTime(parts[1].trim())]
  }

  // ── Structured fallback ─────────────────────────────────────────────────────

  private structuredFallback(termCode: string): ConnectorSection[] {
    const COURSES = [
      { code: 'CSC 210', name: 'Introduction to Computer Science', sections: ['1', '2'] },
      { code: 'CSC 215', name: 'Programming I', sections: ['1', '2', '3'] },
      { code: 'CSC 315', name: 'Data Structures', sections: ['1', '2'] },
      { code: 'CSC 400', name: 'Algorithms', sections: ['1'] },
      { code: 'MTH 201', name: 'Calculus I', sections: ['1', '2', '3'] },
      { code: 'MTH 202', name: 'Calculus II', sections: ['1', '2'] },
      { code: 'MTH 211', name: 'Discrete Structures', sections: ['1', '2'] },
      { code: 'ENG 201', name: 'Communication Skills I', sections: ['1', '2', '3', '4'] },
      { code: 'BUS 200', name: 'Introduction to Business', sections: ['1', '2'] },
      { code: 'ARCH 211', name: 'Architectural Design I', sections: ['1'] },
    ]

    const PATTERNS = [
      { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '09:00', end: '09:50' },
      { days: ['TUESDAY', 'THURSDAY'], start: '10:00', end: '11:15' },
      { days: ['MONDAY', 'WEDNESDAY'], start: '12:00', end: '13:15' },
      { days: ['TUESDAY', 'THURSDAY'], start: '14:00', end: '15:15' },
      { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '13:00', end: '13:50' },
    ]

    const sections: ConnectorSection[] = []
    let idx = 0

    for (const course of COURSES) {
      for (const secNum of course.sections) {
        const pattern = PATTERNS[idx % PATTERNS.length]
        idx++

        const section: ConnectorSection = {
          sourceIdentifier: `LAU-${termCode}-${course.code.replace(' ', '')}-${secNum}`,
          courseCode: course.code,
          courseName: course.name,
          sectionNumber: secNum,
          instructors: [],
          meetings: pattern.days.map(day => ({
            day, startTime: pattern.start, endTime: pattern.end,
            type: 'LECTURE', location: `Byblos Campus B${200 + (idx % 30)}`,
          })),
          capacity:       30,
          enrolled:       undefined,
          seatsRemaining: undefined,
          status:         'UNKNOWN',
          sourceConnector:     this.name,
          historicalInference: true,
          professorConfidence: 'INFERRED',
          completenessScore:   0,
          dataQualityStatus:   'MINIMAL',
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
    return join(CACHE_DIR, `lau-${termCode}.json`)
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
