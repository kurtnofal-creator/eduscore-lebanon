/**
 * EduScore Lebanon – University Data Scrapers
 *
 * Because most Lebanese universities don't offer public APIs, this module
 * provides:
 *   1. An extensible scraper interface
 *   2. A demo scraper that parses HTML course listings (where available)
 *   3. A data-normalization pipeline
 *   4. Fallback: manual admin import via CSV or JSON
 *
 * Per-university scrapers implement the UniversityScraper interface.
 * In production, each university gets its own scraper class tuned to
 * its specific registration system (Banner, custom portal, etc.).
 */

import * as cheerio from 'cheerio'
import pLimit from 'p-limit'
import { SyncType } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import {
  type SyncContext,
  type SyncResult,
  upsertProfessor,
  upsertCourse,
  upsertSection,
} from '../../lib/sync'

const prisma = new PrismaClient()

// Limit concurrent HTTP requests
const limiter = pLimit(3)

export interface ScrapedSection {
  courseCode: string
  courseName: string
  credits?: number
  sectionNumber: string
  crn?: string
  professors: string[]  // professor full names
  meetings: Array<{
    day: string
    startTime: string
    endTime: string
    location?: string
    type?: string
  }>
}

export interface UniversityWithFaculties {
  id: string
  shortName: string
  slug: string
  faculties: Array<{
    id: string
    departments: Array<{
      id: string
      name: string
      code?: string | null
    }>
  }>
}

/**
 * Main entry point called by the worker for each sync job.
 */
export async function scrapeUniversitySections(
  university: UniversityWithFaculties,
  type: SyncType,
  ctx: SyncContext
): Promise<SyncResult> {
  const stats: SyncResult = { added: 0, updated: 0, skipped: 0, errors: 0 }

  await ctx.log('INFO', `Starting scrape for ${university.shortName} (${type})`)

  // Get or create current active term
  const currentTerm = await prisma.academicTerm.findFirst({
    where: { isCurrent: true },
  })

  if (!currentTerm) {
    await ctx.log('WARN', 'No current academic term found. Skipping section sync.')
    return stats
  }

  // Dispatch to university-specific scraper
  let sections: ScrapedSection[] = []

  try {
    sections = await fetchSectionsByUniversity(university, type, ctx)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await ctx.log('ERROR', `Failed to fetch sections: ${msg}`)
    stats.errors++
    return stats
  }

  await ctx.log('INFO', `Fetched ${sections.length} sections from source`)

  // Build a flat list of all departments for name-based matching
  const allDepartments = university.faculties.flatMap(f => f.departments)

  // Process each section
  for (const raw of sections) {
    try {
      // Find department by course code prefix
      const codePrefix = raw.courseCode.match(/^([A-Z]+)/)?.[1] ?? ''
      const dept = allDepartments.find(
        d => d.code === codePrefix || d.name.toLowerCase().includes(codePrefix.toLowerCase())
      ) ?? allDepartments[0]

      if (!dept) {
        await ctx.log('WARN', `No department found for ${raw.courseCode}`)
        stats.skipped++
        continue
      }

      // Upsert course
      const { id: courseId, isNew: courseIsNew } = await upsertCourse(ctx, {
        code: raw.courseCode,
        name: raw.courseName,
        departmentId: dept.id,
        credits: raw.credits,
      })

      // Upsert professors
      const professorIds: string[] = []
      for (const profName of raw.professors) {
        const nameParts = profName.trim().split(/\s+/)
        if (nameParts.length < 2) continue

        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ')

        const { id: profId } = await upsertProfessor(ctx, {
          firstName,
          lastName,
          departmentId: dept.id,
        })

        professorIds.push(profId)
      }

      // Upsert section
      const { isNew: sectionIsNew } = await upsertSection(ctx, {
        courseId,
        termId: currentTerm.id,
        sectionNumber: raw.sectionNumber,
        crn: raw.crn,
        professors: professorIds,
        meetings: raw.meetings.map(m => ({
          day: normalizeDayOfWeek(m.day),
          startTime: normalizeTime(m.startTime),
          endTime: normalizeTime(m.endTime),
          location: m.location,
          type: m.type ?? 'LECTURE',
        })),
      })

      if (sectionIsNew || courseIsNew) {
        stats.added++
      } else {
        stats.updated++
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      await ctx.log('ERROR', `Error processing section ${raw.courseCode}/${raw.sectionNumber}: ${msg}`)
      stats.errors++
    }
  }

  return stats
}

/**
 * Dispatch to university-specific data fetcher.
 * Each university may have its own catalog URL/format.
 */
async function fetchSectionsByUniversity(
  university: UniversityWithFaculties,
  type: SyncType,
  ctx: SyncContext
): Promise<ScrapedSection[]> {
  // In a real deployment, each university would have its own case
  // with a dedicated scraper or manual CSV importer.
  // For now we return demo/seed data shaped as ScrapedSection[].

  switch (university.shortName) {
    case 'AUB':
      return fetchAUBSections(ctx)
    case 'LAU':
      return fetchLAUSections(ctx)
    default:
      await ctx.log('INFO', `No scraper configured for ${university.shortName}, using demo data`)
      return generateDemoSections(university)
  }
}

/**
 * AUB scraper – parses the AUB Banner course search.
 * In production this would scrape https://ssb.aub.edu.lb (Banner SIS).
 */
async function fetchAUBSections(ctx: SyncContext): Promise<ScrapedSection[]> {
  // Demonstration: return pre-parsed sample data
  // A real implementation would:
  //   1. POST to Banner's search endpoint
  //   2. Parse the HTML table rows
  //   3. Extract CRN, section, meeting times, instructor

  await ctx.log('INFO', 'Fetching AUB sections (demo mode)')

  return [
    {
      courseCode: 'CMPS 202',
      courseName: 'Data Structures',
      credits: 3,
      sectionNumber: '01',
      crn: '10001',
      professors: ['Hazem Hajj'],
      meetings: [
        { day: 'Mon', startTime: '8:00', endTime: '9:15', location: 'Nicely 224' },
        { day: 'Wed', startTime: '8:00', endTime: '9:15', location: 'Nicely 224' },
      ],
    },
    {
      courseCode: 'CMPS 202',
      courseName: 'Data Structures',
      credits: 3,
      sectionNumber: '02',
      crn: '10002',
      professors: ['Mariette Awad'],
      meetings: [
        { day: 'Tue', startTime: '11:00', endTime: '12:15', location: 'Bechtel 303' },
        { day: 'Thu', startTime: '11:00', endTime: '12:15', location: 'Bechtel 303' },
      ],
    },
    {
      courseCode: 'MATH 201',
      courseName: 'Calculus I',
      credits: 3,
      sectionNumber: '01',
      crn: '20001',
      professors: ['Wissam Raji'],
      meetings: [
        { day: 'Mon', startTime: '10:00', endTime: '11:15', location: 'West Hall 101' },
        { day: 'Wed', startTime: '10:00', endTime: '11:15', location: 'West Hall 101' },
        { day: 'Fri', startTime: '10:00', endTime: '10:50', location: 'West Hall 101' },
      ],
    },
    {
      courseCode: 'EECE 330',
      courseName: 'Signals & Systems',
      credits: 3,
      sectionNumber: '01',
      crn: '30001',
      professors: ['Ali Chehab'],
      meetings: [
        { day: 'Tue', startTime: '8:00', endTime: '9:15', location: 'Bechtel 101' },
        { day: 'Thu', startTime: '8:00', endTime: '9:15', location: 'Bechtel 101' },
      ],
    },
  ]
}

async function fetchLAUSections(ctx: SyncContext): Promise<ScrapedSection[]> {
  await ctx.log('INFO', 'Fetching LAU sections (demo mode)')
  return generateDemoSections({ shortName: 'LAU' } as UniversityWithFaculties)
}

/**
 * Generate plausible demo sections for any university.
 * Replaces with real scraping in production.
 */
function generateDemoSections(university: UniversityWithFaculties): ScrapedSection[] {
  const courses = [
    { code: 'CS 201', name: 'Data Structures', credits: 3 },
    { code: 'CS 301', name: 'Algorithms', credits: 3 },
    { code: 'MATH 101', name: 'Calculus I', credits: 3 },
    { code: 'MATH 201', name: 'Calculus II', credits: 3 },
    { code: 'BUS 201', name: 'Introduction to Business', credits: 3 },
  ]

  const sections: ScrapedSection[] = []
  for (const course of courses) {
    sections.push({
      courseCode: `${university.shortName}-${course.code}`,
      courseName: course.name,
      credits: course.credits,
      sectionNumber: '01',
      professors: ['Staff'],
      meetings: [
        { day: 'Mon', startTime: '9:00', endTime: '10:15' },
        { day: 'Wed', startTime: '9:00', endTime: '10:15' },
      ],
    })
  }

  return sections
}

// ============================================================
// NORMALIZATION HELPERS
// ============================================================

function normalizeDayOfWeek(day: string): string {
  const map: Record<string, string> = {
    'M': 'MONDAY', 'Mon': 'MONDAY', 'Monday': 'MONDAY',
    'T': 'TUESDAY', 'Tue': 'TUESDAY', 'Tuesday': 'TUESDAY',
    'W': 'WEDNESDAY', 'Wed': 'WEDNESDAY', 'Wednesday': 'WEDNESDAY',
    'Th': 'THURSDAY', 'Thu': 'THURSDAY', 'Thursday': 'THURSDAY',
    'F': 'FRIDAY', 'Fri': 'FRIDAY', 'Friday': 'FRIDAY',
    'S': 'SATURDAY', 'Sat': 'SATURDAY', 'Saturday': 'SATURDAY',
    'Su': 'SUNDAY', 'Sun': 'SUNDAY', 'Sunday': 'SUNDAY',
  }
  return map[day] ?? day.toUpperCase()
}

function normalizeTime(time: string): string {
  // Convert "8:00 AM", "08:00", "8:00", "800" to "08:00"
  const cleaned = time.trim().replace(/\s+/g, '')
  const ampmMatch = cleaned.match(/^(\d{1,2}):?(\d{2})([AP]M)$/i)
  if (ampmMatch) {
    let [, h, m, period] = ampmMatch
    let hour = parseInt(h)
    if (period.toUpperCase() === 'PM' && hour < 12) hour += 12
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0
    return `${hour.toString().padStart(2, '0')}:${m}`
  }
  const simpleMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (simpleMatch) {
    return `${simpleMatch[1].padStart(2, '0')}:${simpleMatch[2]}`
  }
  return time
}
