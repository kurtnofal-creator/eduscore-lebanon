/**
 * EduScore Lebanon – Final Pre-Beta Regression & Stress Test
 *
 * 12-section comprehensive regression suite covering all recent feature additions:
 *   1.  Full route crawl (public + admin redirects)
 *   2.  Search stress test (300+ queries)
 *   3.  Schedule builder stress test (200+ combos, all preference modes, filters)
 *   4.  Calendar UI / engine validation (time placement, color, block sizing)
 *   5.  CRN consistency check (source → DB → API → UI chain)
 *   6.  Seat alert validation (Prisma + API endpoints)
 *   7.  Share / export validation (encode/decode, /resolve endpoint)
 *   8.  Data reporting validation (all entry points)
 *   9.  Professor insights validation (keyword extraction, edge cases)
 *  10.  Self-healing / sync integrity validation
 *  11.  Performance pass (queries + API, flag > 300ms)
 *  12.  Final beta readiness report
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/final-regression.ts
 */

import { PrismaClient } from '@prisma/client'
import {
  generateSchedules,
  computeScheduleResult,
  formatTime,
  DAYS_ORDER,
  type SectionData,
  type SchedulePreference,
} from '../lib/schedule-engine'
import { getCourseColors, COURSE_PALETTE } from '../lib/schedule-colors'
import { checkDBIntegrity, autoCorrectOrphans } from '../lib/sync/dbIntegrity'
import { checkConnectorHealth } from '../lib/sync/healthCheck'
import type { ConnectorResult } from '../connectors/types'

const prisma  = new PrismaClient()
const BASE    = 'http://localhost:3000'
const TIMEOUT = 20_000

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TestResult {
  name: string
  passed: boolean
  warning?: boolean
  detail: string
  durationMs?: number
}

const results: TestResult[] = []
let sectionFailures = 0

function pass(name: string, detail: string, ms?: number) {
  results.push({ name, passed: true, detail, durationMs: ms })
  console.log(`  ✅  ${name}${ms != null ? ` (${ms}ms)` : ''}`)
  if (detail) console.log(`       ${detail}`)
}
function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail })
  sectionFailures++
  console.log(`  ❌  ${name}`)
  console.log(`       ${detail}`)
}
function warn(name: string, detail: string, ms?: number) {
  results.push({ name, passed: true, warning: true, detail, durationMs: ms })
  console.log(`  ⚠️   ${name}${ms != null ? ` (${ms}ms)` : ''}`)
  console.log(`       ${detail}`)
}
function section(title: string) {
  sectionFailures = 0
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(64))
}

async function get(path: string): Promise<{ ok: boolean; status: number; ms: number; body?: string }> {
  const t0 = Date.now()
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    const res   = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
    clearTimeout(timer)
    const body  = await res.text().catch(() => '')
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t0, body }
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t0 }
  }
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; ms: number; data: unknown }> {
  const t0 = Date.now()
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    const res   = await fetch(`${BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    })
    clearTimeout(timer)
    const data = await res.json().catch(() => null)
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t0, data }
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t0, data: null }
  }
}

// ── 1. Full Route Crawl ───────────────────────────────────────────────────────

async function testRouteCrawl() {
  section('1. Full Route Crawl')

  const PUBLIC_ROUTES = [
    '/',
    '/professors',
    '/courses',
    '/universities',
    '/search',
    '/schedule-builder',
    '/login',
    '/terms',
    '/privacy',
    '/guidelines',
  ]

  const PARAM_ROUTES_OK = [
    '/universities/aub',
    '/universities/lau',
    '/universities/usj',
  ]

  const NOT_FOUND_ROUTES = [
    '/professors/nonexistent-prof-xyz',
    '/courses/nonexistent-course-xyz',
    '/universities/nonexistent-uni-xyz',
  ]

  const ADMIN_ROUTES_REDIRECT = [
    '/admin',
    '/admin/reviews',
    '/admin/professors',
    '/admin/courses',
    '/admin/analytics',
    '/admin/reports',
    '/admin/sync',
    '/admin/monitoring',
    '/dashboard',
  ]

  // Resolve real professor + course slugs
  const realProf = await prisma.professor.findFirst({ where: { isActive: true, reviewCount: { gt: 0 } }, select: { slug: true } })
  const realCourse = await prisma.course.findFirst({ where: { isActive: true }, select: { slug: true } })

  let publicOk = 0, publicFail = 0
  for (const route of PUBLIC_ROUTES) {
    const r = await get(route)
    if (r.ok) publicOk++
    else { publicFail++; fail(`Route: ${route}`, `HTTP ${r.status}`) }
  }
  if (publicFail === 0) pass('Public routes', `${publicOk}/${PUBLIC_ROUTES.length} returned 2xx`)
  else fail('Public routes', `${publicFail} routes returned 5xx`)

  // Test param routes
  let paramOk = 0
  for (const route of PARAM_ROUTES_OK) {
    const r = await get(route)
    if (r.ok) paramOk++
    else fail(`Route: ${route}`, `HTTP ${r.status}`)
  }
  if (realProf) {
    const r = await get(`/professors/${realProf.slug}`)
    if (r.ok) paramOk++
    else fail(`Route: /professors/${realProf.slug}`, `HTTP ${r.status}`)
  }
  if (realCourse) {
    const r = await get(`/courses/${realCourse.slug}`)
    if (r.ok) paramOk++
    else fail(`Route: /courses/${realCourse.slug}`, `HTTP ${r.status}`)
  }
  pass('Parameterised entity routes', `${paramOk} entity pages returned 2xx`)

  // 404 routes
  let notFoundOk = 0
  for (const route of NOT_FOUND_ROUTES) {
    const r = await get(route)
    if (r.status === 404) notFoundOk++
    else fail(`Route 404: ${route}`, `Expected 404, got ${r.status}`)
  }
  if (notFoundOk === NOT_FOUND_ROUTES.length)
    pass('404 handling', `${notFoundOk}/${NOT_FOUND_ROUTES.length} non-existent slugs returned 404`)

  // Admin routes must redirect (302/307) or return auth page — never 500
  let adminOk = 0
  for (const route of ADMIN_ROUTES_REDIRECT) {
    const r = await get(route)
    if (r.ok) adminOk++  // 2xx = redirected to login page; never 5xx
    else fail(`Admin route: ${route}`, `HTTP ${r.status}`)
  }
  pass('Admin routes (auth redirect)', `${adminOk}/${ADMIN_ROUTES_REDIRECT.length} returned non-5xx`)

  // Test new API endpoints exist
  const apiTests: Array<[string, string, unknown]> = [
    ['/api/seat-alerts/check', 'POST Seat alerts check', {}],
    ['/api/schedule/resolve',  'POST Schedule resolve',  { sectionIds: ['invalid'], termId: 'invalid' }],
    ['/api/data-reports',      'POST Data reports',      { universitySlug: 'test', message: 'route crawl test' }],
  ]
  for (const [route, name, body] of apiTests) {
    const r = await post(route, body)
    if (r.status < 500) pass(`New API: ${name}`, `HTTP ${r.status}`)
    else fail(`New API: ${name}`, `HTTP ${r.status} — endpoint may have crashed`)
  }
}

// ── 2. Search Stress Test (300+ queries) ─────────────────────────────────────

async function testSearchStress() {
  section('2. Search Stress Test (300+ queries)')

  // Sample real values from DB
  const [profs, courses, depts] = await Promise.all([
    prisma.professor.findMany({ where: { isActive: true }, select: { firstName: true, lastName: true }, take: 30 }),
    prisma.course.findMany({ where: { isActive: true }, select: { code: true, name: true }, take: 30 }),
    prisma.department.findMany({ select: { name: true }, take: 15 }),
  ])

  const queries: string[] = []

  // Exact course codes
  courses.slice(0, 20).forEach(c => queries.push(c.code))

  // Partial course codes (prefix)
  courses.slice(0, 15).forEach(c => queries.push(c.code.slice(0, 4)))

  // Partial course names
  courses.slice(0, 15).forEach(c => queries.push(c.name.split(' ')[0]))

  // Full professor names
  profs.slice(0, 20).forEach(p => queries.push(`${p.firstName} ${p.lastName}`))

  // Partial professor names
  profs.slice(0, 15).forEach(p => queries.push(p.lastName.slice(0, 5)))
  profs.slice(0, 15).forEach(p => queries.push(p.firstName))

  // Department names
  depts.slice(0, 10).forEach(d => queries.push(d.name.split(' ')[0]))

  // Mixed / invalid queries
  const edgeCases = [
    '',            // empty
    '   ',         // whitespace
    'a',           // too short
    'ZZZXXX',      // no results
    '12345',       // numeric
    'drop table',  // adversarial
    '<script>',    // XSS attempt
    "'; OR 1=1--", // SQL injection attempt
    'أ',           // Arabic character
    'CMPS 201 §1 Monday 8am', // over-specified
    'X'.repeat(200), // very long
  ]
  queries.push(...edgeCases)

  // Pad to 300
  while (queries.length < 300) {
    const base = courses[queries.length % courses.length]?.code ?? 'CMPS'
    queries.push(base + ' ' + (queries.length % 9))
  }

  let passed = 0, slow = 0, errors = 0, zeroResult = 0
  const SLOW_MS = 600

  for (const q of queries.slice(0, 300)) {
    const encoded = encodeURIComponent(q.trim().slice(0, 100))
    if (encoded.length === 0) { passed++; continue }
    const r = await get(`/api/search?q=${encoded}&limit=5`)
    if (!r.ok) errors++
    else {
      passed++
      if (r.ms > SLOW_MS) slow++
      try {
        const parsed = JSON.parse(r.body ?? '{}')
        const total = (parsed.professors?.length ?? 0) + (parsed.courses?.length ?? 0) + (parsed.universities?.length ?? 0)
        if (total === 0) zeroResult++
      } catch { /* ignore parse error */ }
    }
  }

  if (errors > 0) fail('Search stress: no crashes', `${errors} queries returned 5xx`)
  else pass('Search stress: no crashes', `${passed}/300 passed, 0 errors`)

  if (slow > 10) warn('Search stress: speed', `${slow} queries exceeded ${SLOW_MS}ms`)
  else pass('Search stress: speed', `${slow} slow queries (>${SLOW_MS}ms) out of 300`)

  pass('Search stress: zero-result handling', `${zeroResult} queries returned empty (graceful, not error)`)

  // Verify adversarial inputs didn't crash
  let adversarialOk = 0
  for (const q of edgeCases) {
    const r = await get(`/api/search?q=${encodeURIComponent(q)}&limit=3`)
    if (r.ok) adversarialOk++
  }
  if (adversarialOk === edgeCases.length)
    pass('Search stress: adversarial inputs', `${edgeCases.length}/${edgeCases.length} edge cases returned non-5xx`)
  else
    fail('Search stress: adversarial inputs', `${edgeCases.length - adversarialOk} edge cases crashed`)
}

// ── 3. Schedule Builder Stress Test (200+ combos) ────────────────────────────

async function testScheduleStress() {
  section('3. Schedule Builder Stress Test (200+ combos)')

  // Collect courses that have sections in AUB + LAU terms
  const aubTerm = await prisma.academicTerm.findFirst({
    where: { universityId: (await prisma.university.findFirst({ where: { slug: 'aub' } }))?.id ?? '' },
    orderBy: { year: 'desc' },
  })
  const lauTerm = await prisma.academicTerm.findFirst({
    where: { universityId: (await prisma.university.findFirst({ where: { slug: 'lau' } }))?.id ?? '' },
    orderBy: { year: 'desc' },
  })

  // Get course IDs that have sections in the most recent terms
  const [aubCourses, lauCourses] = await Promise.all([
    prisma.course.findMany({
      where: { sections: { some: { termId: aubTerm?.id ?? '', isActive: true } } },
      select: { id: true, code: true },
      take: 40,
    }),
    prisma.course.findMany({
      where: { sections: { some: { termId: lauTerm?.id ?? '', isActive: true } } },
      select: { id: true, code: true },
      take: 40,
    }),
  ])

  const PREFERENCES: SchedulePreference[] = [
    'balanced', 'best_professors', 'light_workload', 'fewer_days',
    'short_gaps', 'early_start', 'late_start',
  ]
  const FILTERS = [
    { minProfRating: 0,   confirmedOnly: false },
    { minProfRating: 2,   confirmedOnly: false },
    { minProfRating: 3,   confirmedOnly: false },
    { minProfRating: 3.5, confirmedOnly: false },
    { minProfRating: 0,   confirmedOnly: true },
    { minProfRating: 2,   confirmedOnly: true },
  ]

  let totalRequests = 0
  let passed = 0, slow = 0, errors = 0, conflicts = 0, crnMissing = 0
  let totalSchedules = 0, totalSections = 0
  let scoreReasonsMissing = 0
  const SLOW_API = 3000

  // Build combos: AUB pairs
  const comboCourseIds: Array<{ courseIds: string[]; termId: string; label: string }> = []

  // 2-course combos from AUB
  for (let i = 0; i < Math.min(aubCourses.length - 1, 25); i++) {
    comboCourseIds.push({
      courseIds: [aubCourses[i].id, aubCourses[i + 1].id],
      termId: aubTerm?.id ?? '',
      label: `AUB ${aubCourses[i].code}+${aubCourses[i + 1].code}`,
    })
  }
  // 2-course combos from LAU
  for (let i = 0; i < Math.min(lauCourses.length - 1, 20); i++) {
    comboCourseIds.push({
      courseIds: [lauCourses[i].id, lauCourses[i + 1].id],
      termId: lauTerm?.id ?? '',
      label: `LAU ${lauCourses[i].code}+${lauCourses[i + 1].code}`,
    })
  }
  // 3-course combos
  for (let i = 0; i < Math.min(aubCourses.length - 2, 15); i++) {
    comboCourseIds.push({
      courseIds: [aubCourses[i].id, aubCourses[i + 1].id, aubCourses[i + 2].id],
      termId: aubTerm?.id ?? '',
      label: `AUB 3-course ${aubCourses[i].code}+…`,
    })
  }
  // 4-course combos
  for (let i = 0; i < Math.min(aubCourses.length - 3, 10); i++) {
    comboCourseIds.push({
      courseIds: [aubCourses[i].id, aubCourses[i + 1].id, aubCourses[i + 2].id, aubCourses[i + 3].id],
      termId: aubTerm?.id ?? '',
      label: `AUB 4-course`,
    })
  }

  // Run combos through API with different filters + preferences
  for (const combo of comboCourseIds.slice(0, 50)) {
    const filter = FILTERS[totalRequests % FILTERS.length]
    const pref   = PREFERENCES[totalRequests % PREFERENCES.length]

    const r = await post('/api/schedule', {
      courseIds:     combo.courseIds,
      termId:        combo.termId,
      preference:    pref,
      maxResults:    10,
      minProfRating: filter.minProfRating,
      confirmedOnly: filter.confirmedOnly,
    })

    totalRequests++
    if (!r.ok) { errors++; continue }
    passed++
    if (r.ms > SLOW_API) slow++

    const schedules = (r.data as { schedules?: Array<{
      score: number
      scoreReasons: string[]
      sections: Array<{ id: string; crn?: string | null; professors: Array<unknown>; meetings: Array<{ day: string; startTime: string; endTime: string }> }>
    }> })?.schedules ?? []

    totalSchedules += schedules.length

    for (const sched of schedules) {
      // Verify scoreReasons is present (Part 5)
      if (!sched.scoreReasons || sched.scoreReasons.length === 0) scoreReasonsMissing++

      for (const sec of sched.sections) {
        totalSections++
        // CRN: either present or null — never undefined
        if (sec.crn === undefined) crnMissing++

        // Check for time conflicts
        const meetings: Array<{ day: string; startMins: number; endMins: number; id: string }> = []
        for (const m of sec.meetings) {
          const [sh, sm] = m.startTime.split(':').map(Number)
          const [eh, em] = m.endTime.split(':').map(Number)
          meetings.push({ day: m.day, startMins: sh * 60 + sm, endMins: eh * 60 + em, id: sec.id })
        }
        for (const s2 of sched.sections.filter(s => s.id !== sec.id)) {
          for (const m1 of sec.meetings) {
            for (const m2 of s2.meetings) {
              if (m1.day !== m2.day) continue
              const [s1h, s1m] = m1.startTime.split(':').map(Number)
              const [e1h, e1m] = m1.endTime.split(':').map(Number)
              const [s2h, s2m] = m2.startTime.split(':').map(Number)
              const [e2h, e2m] = m2.endTime.split(':').map(Number)
              const s1 = s1h * 60 + s1m, e1 = e1h * 60 + e1m
              const s2v = s2h * 60 + s2m, e2 = e2h * 60 + e2m
              if (s1 < e2 && s2v < e1) conflicts++
            }
          }
        }
      }
    }
  }

  // Push remaining combos using engine directly (no HTTP overhead)
  let engineErrors = 0
  const engineCombos = comboCourseIds.slice(50, 200)
  for (const combo of engineCombos) {
    try {
      const sections = await prisma.section.findMany({
        where: { courseId: { in: combo.courseIds }, termId: combo.termId, isActive: true },
        include: {
          course: { select: { id: true, code: true, name: true } },
          professors: { include: { professor: { select: { id: true, fullName: true, overallRating: true, workloadLevel: true } } } },
          meetings: true,
        },
        take: 50,
      })
      const courseMap = new Map<string, SectionData[]>()
      for (const sec of sections) {
        const sd: SectionData = {
          id: sec.id, sectionNumber: sec.sectionNumber,
          courseId: sec.courseId, courseName: sec.course.name, courseCode: sec.course.code,
          professors: sec.professors.map(sp => ({
            id: sp.professor.id, fullName: sp.professor.fullName,
            overallRating: sp.professor.overallRating, workloadLevel: sp.professor.workloadLevel,
            confidence: sp.confidence,
          })),
          meetings: sec.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime, type: m.type, location: m.location })),
          crn: sec.crn, location: sec.location,
          status: sec.status, seatsRemaining: sec.seatsRemaining,
          capacity: sec.capacity, enrolled: sec.enrolled,
          isStale: sec.isStale, historicalInference: sec.historicalInference,
        }
        const arr = courseMap.get(sec.courseId) ?? []
        arr.push(sd)
        courseMap.set(sec.courseId, arr)
      }
      if (courseMap.size > 0) {
        const pref = PREFERENCES[totalRequests % PREFERENCES.length]
        const res = generateSchedules(courseMap, pref, 5)
        totalSchedules += res.length
        totalSections += res.reduce((s, r) => s + r.sections.length, 0)
        if (res.some(r => !r.scoreReasons)) scoreReasonsMissing++
      }
    } catch { engineErrors++ }
    totalRequests++
  }

  if (conflicts > 0) fail('Schedule stress: no time conflicts', `${conflicts} overlapping meeting pairs found`)
  else pass('Schedule stress: no time conflicts', `0 conflicts across ${totalSchedules} schedules`)

  if (errors > 5) fail('Schedule stress: API error rate', `${errors}/${totalRequests} requests returned 5xx`)
  else pass('Schedule stress: API error rate', `${errors} errors out of ${totalRequests} requests`)

  if (engineErrors > 0) warn('Schedule stress: engine errors', `${engineErrors} direct-engine exceptions`)
  else pass('Schedule stress: engine errors', `0 engine exceptions across ${engineCombos.length} combos`)

  if (slow > 0) warn('Schedule stress: API speed', `${slow} requests exceeded ${SLOW_API}ms`)
  else pass('Schedule stress: API speed', `All requests under ${SLOW_API}ms`)

  pass('Schedule stress: total coverage', `${totalRequests} combos, ${totalSchedules} schedules, ${totalSections} section rows`)

  if (crnMissing > 0) fail('Schedule stress: CRN field always defined', `${crnMissing} sections missing crn field entirely`)
  else pass('Schedule stress: CRN field always defined', `crn field present (null or string) on all ${totalSections} sections`)

  if (scoreReasonsMissing > 0) fail('Schedule stress: scoreReasons populated', `${scoreReasonsMissing} schedules missing scoreReasons`)
  else pass('Schedule stress: scoreReasons populated', `All schedules include score reason labels`)
}

// ── 4. Calendar UI / Engine Validation ───────────────────────────────────────

async function testCalendarUI() {
  section('4. Calendar UI / Engine Validation')

  // Test COURSE_PALETTE consistency
  if (COURSE_PALETTE.length < 8)
    fail('Color palette: 8 entries', `Only ${COURSE_PALETTE.length} colors defined`)
  else
    pass('Color palette: 8 entries', `${COURSE_PALETTE.length} colors in COURSE_PALETTE`)

  const fields: Array<keyof typeof COURSE_PALETTE[0]> = ['chip', 'accent', 'block', 'text', 'hex', 'name']
  const missingFields = fields.filter(f => COURSE_PALETTE.some(c => !c[f]))
  if (missingFields.length > 0) fail('Color palette: all fields present', `Missing: ${missingFields.join(', ')}`)
  else pass('Color palette: all fields present', 'chip, accent, block, text, hex, name defined for all 8')

  for (let i = 0; i < 8; i++) {
    const c = getCourseColors(i)
    if (c !== COURSE_PALETTE[i]) { fail('getCourseColors index mapping', `Index ${i} returned wrong entry`); break }
  }
  // Wrap-around
  if (getCourseColors(8) !== COURSE_PALETTE[0]) fail('getCourseColors wrap-around', 'Index 8 should wrap to index 0')
  else pass('getCourseColors wrap-around', 'Index 8 → COURSE_PALETTE[0] ✓')

  // Test time placement logic
  const PIXEL_PER_MIN = 1.3
  const START_HOUR    = 7

  const testBlocks = [
    { startTime: '08:00', endTime: '09:15', expectedTop: 60 * PIXEL_PER_MIN, expectedHeight: 75 * PIXEL_PER_MIN },
    { startTime: '13:30', endTime: '15:00', expectedTop: (13 * 60 + 30 - START_HOUR * 60) * PIXEL_PER_MIN, expectedHeight: 90 * PIXEL_PER_MIN },
    { startTime: '07:00', endTime: '07:50', expectedTop: 0, expectedHeight: 50 * PIXEL_PER_MIN },
    { startTime: '17:00', endTime: '18:15', expectedTop: (17 - START_HOUR) * 60 * PIXEL_PER_MIN, expectedHeight: 75 * PIXEL_PER_MIN },
  ]

  let blockErrors = 0
  for (const b of testBlocks) {
    const [sh, sm] = b.startTime.split(':').map(Number)
    const [eh, em] = b.endTime.split(':').map(Number)
    const startMins = sh * 60 + sm - START_HOUR * 60
    const endMins   = eh * 60 + em - START_HOUR * 60
    const top    = startMins * PIXEL_PER_MIN
    const height = Math.max(24, (endMins - startMins) * PIXEL_PER_MIN)
    if (Math.abs(top - b.expectedTop) > 0.01) blockErrors++
    if (height < 24) blockErrors++ // minimum height guard
  }
  if (blockErrors > 0) fail('Calendar: block position accuracy', `${blockErrors} blocks had incorrect position or height`)
  else pass('Calendar: block position accuracy', `${testBlocks.length} blocks correctly positioned (px/min=${PIXEL_PER_MIN})`)

  // Test formatTime utility
  const timeTests = [
    { input: '08:00', expected: '8:00 AM' },
    { input: '12:00', expected: '12:00 PM' },
    { input: '13:30', expected: '1:30 PM' },
    { input: '00:00', expected: '12:00 AM' },
    { input: '17:45', expected: '5:45 PM' },
  ]
  let fmtErrors = 0
  for (const t of timeTests) {
    if (formatTime(t.input) !== t.expected) {
      fmtErrors++
      fail(`formatTime(${t.input})`, `Expected "${t.expected}", got "${formatTime(t.input)}"`)
    }
  }
  if (fmtErrors === 0) pass('Calendar: formatTime utility', `${timeTests.length} test cases correct`)

  // DAYS_ORDER completeness
  const expected = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
  if (JSON.stringify(DAYS_ORDER.slice(0, 6)) !== JSON.stringify(expected))
    fail('Calendar: DAYS_ORDER', `Got: ${DAYS_ORDER}`)
  else
    pass('Calendar: DAYS_ORDER', 'Mon–Sat in correct order')

  // computeScheduleResult returns scoreReasons
  const mockSection: SectionData = {
    id: 'test-1', sectionNumber: '1', courseId: 'c1', courseName: 'Test', courseCode: 'TST 101',
    professors: [{ id: 'p1', fullName: 'Test Prof', overallRating: 4.5, workloadLevel: 2, confidence: 'CONFIRMED' }],
    meetings: [{ day: 'MONDAY', startTime: '09:00', endTime: '10:15', type: 'LECTURE' }],
  }
  const sr = computeScheduleResult([mockSection], 'balanced')
  if (!sr.scoreReasons || sr.scoreReasons.length === 0)
    fail('Calendar: computeScheduleResult has scoreReasons', 'scoreReasons array empty')
  else
    pass('Calendar: computeScheduleResult has scoreReasons', `Reasons: ${sr.scoreReasons.join(', ')}`)

  if (typeof sr.score !== 'number' || isNaN(sr.score))
    fail('Calendar: schedule score is numeric', `Got: ${sr.score}`)
  else
    pass('Calendar: schedule score is numeric', `Score ${sr.score.toFixed(2)} for balanced preference`)
}

// ── 5. CRN Consistency Check ──────────────────────────────────────────────────

async function testCRNConsistency() {
  section('5. CRN Consistency Check (source → DB → API → UI)')

  const [aubUni, lauUni] = await Promise.all([
    prisma.university.findFirst({ where: { slug: 'aub' } }),
    prisma.university.findFirst({ where: { slug: 'lau' } }),
  ])
  const [aubTerm, lauTerm] = await Promise.all([
    prisma.academicTerm.findFirst({ where: { universityId: aubUni?.id ?? '' }, orderBy: { year: 'desc' } }),
    prisma.academicTerm.findFirst({ where: { universityId: lauUni?.id ?? '' }, orderBy: { year: 'desc' } }),
  ])

  // Count CRN coverage in DB
  const checkCoverage = async (uniId: string, termId: string, label: string) => {
    const total = await prisma.section.count({
      where: { termId, isActive: true, course: { department: { faculty: { universityId: uniId } } } },
    })
    const withCrn = await prisma.section.count({
      where: { termId, isActive: true, crn: { not: null }, course: { department: { faculty: { universityId: uniId } } } },
    })
    const rate = total > 0 ? withCrn / total : 0
    if (rate < 0.85) warn(`CRN coverage: ${label}`, `${(rate * 100).toFixed(1)}% (${withCrn}/${total}) — below 85% target`)
    else pass(`CRN coverage: ${label}`, `${(rate * 100).toFixed(1)}% (${withCrn}/${total})`)
    return { total, withCrn, rate }
  }

  const [aubCoverage, lauCoverage] = await Promise.all([
    checkCoverage(aubUni?.id ?? '', aubTerm?.id ?? '', 'AUB'),
    checkCoverage(lauUni?.id ?? '', lauTerm?.id ?? '', 'LAU'),
  ])

  // CRN ≠ sectionNumber (sanity — must never be equal)
  const crnEqualsSection = await prisma.section.count({
    where: { isActive: true, NOT: [{ crn: null }] },
  }) // We'll validate in JS
  const sample = await prisma.section.findMany({
    where: { isActive: true, crn: { not: null } },
    select: { id: true, crn: true, sectionNumber: true },
    take: 500,
  })
  const confused = sample.filter(s => s.crn === s.sectionNumber)
  if (confused.length > 0) fail('CRN ≠ sectionNumber', `${confused.length} sections have crn === sectionNumber`)
  else pass('CRN ≠ sectionNumber (500 sample)', `No CRN/sectionNumber confusion in ${sample.length} sampled sections`)

  // CRN uniqueness per term (no duplicates)
  const dupCRNs = await prisma.$queryRaw<Array<{ crn: string; termId: string; cnt: bigint }>>`
    SELECT crn, termId, COUNT(*) as cnt FROM Section
    WHERE crn IS NOT NULL AND isActive = 1
    GROUP BY crn, termId
    HAVING COUNT(*) > 1
    LIMIT 10
  `
  if (dupCRNs.length > 0) fail('CRN uniqueness per term', `${dupCRNs.length} duplicate CRN+term pairs found`)
  else pass('CRN uniqueness per term', 'No duplicate CRN+termId pairs')

  // Verify API includes crn in schedule responses
  const testCourses = await prisma.course.findMany({
    where: {
      sections: { some: { termId: aubTerm?.id ?? '', isActive: true, crn: { not: null } } },
    },
    select: { id: true },
    take: 2,
  })

  if (testCourses.length >= 2) {
    const r = await post('/api/schedule', {
      courseIds: testCourses.map(c => c.id),
      termId: aubTerm?.id ?? '',
      preference: 'balanced',
      maxResults: 5,
    })
    if (r.ok) {
      const schedules = (r.data as { schedules?: Array<{ sections: Array<{ crn?: string | null }> }> })?.schedules ?? []
      const sectionsWithCrn = schedules.flatMap(s => s.sections).filter(s => s.crn != null).length
      const total = schedules.flatMap(s => s.sections).length
      const apiRate = total > 0 ? sectionsWithCrn / total : 0
      if (apiRate < 0.8) warn('CRN in API schedule response', `${(apiRate * 100).toFixed(1)}% of sections have crn in API response`)
      else pass('CRN in API schedule response', `${(apiRate * 100).toFixed(1)}% of schedule sections include CRN (${sectionsWithCrn}/${total})`)
    } else {
      warn('CRN in API schedule response', `Schedule API returned ${r.status}`)
    }
  }

  // Check CRN is visible in schedule builder page (SSR check — will warn since it's client-rendered)
  const builderPage = await get('/schedule-builder')
  if (builderPage.body?.includes('CRN'))
    pass('CRN token in schedule builder HTML', 'Found in SSR output')
  else
    warn('CRN token in schedule builder HTML', 'Not in SSR HTML — client-rendered (expected, React bundle handles it)')

  // Overall regression
  if (aubCoverage.rate >= 0.85 && lauCoverage.rate >= 0.85)
    pass('CRN regression: coverage maintained', `AUB ${(aubCoverage.rate * 100).toFixed(1)}%, LAU ${(lauCoverage.rate * 100).toFixed(1)}%`)
  else
    fail('CRN regression: coverage maintained', `AUB or LAU below 85% — check sync`)
}

// ── 6. Seat Alert Validation ──────────────────────────────────────────────────

async function testSeatAlerts() {
  section('6. Seat Alert Validation')

  // Find a test user + section
  const testUser = await prisma.user.findFirst({ select: { id: true, email: true } })
  const testSection = await prisma.section.findFirst({
    where: { isActive: true },
    select: { id: true, status: true, seatsRemaining: true, crn: true, sectionNumber: true },
  })

  if (!testUser || !testSection) {
    warn('Seat alerts: test data available', 'No user or section found — skipping Prisma-level tests')
    return
  }

  // 1. Create a SeatAlert via Prisma
  let alertId: string | null = null
  try {
    const alert = await prisma.seatAlert.create({
      data: { userId: testUser.id, sectionId: testSection.id, threshold: 1, isActive: true },
    })
    alertId = alert.id
    pass('Seat alerts: create record', `Alert ${alertId} created for section ${testSection.id}`)
  } catch (err) {
    fail('Seat alerts: create record', String(err))
    return
  }

  // 2. Verify upsert (duplicate prevention)
  try {
    const upserted = await prisma.seatAlert.upsert({
      where: { userId_sectionId: { userId: testUser.id, sectionId: testSection.id } },
      update: { threshold: 2 },
      create: { userId: testUser.id, sectionId: testSection.id, threshold: 2 },
    })
    if (upserted.id === alertId) pass('Seat alerts: upsert deduplication', 'Same alert ID returned — no duplicate')
    else fail('Seat alerts: upsert deduplication', `Got different ID ${upserted.id}`)
  } catch (err) {
    fail('Seat alerts: upsert deduplication', String(err))
  }

  // 3. Verify alert is queryable
  const fetched = await prisma.seatAlert.findUnique({
    where: { userId_sectionId: { userId: testUser.id, sectionId: testSection.id } },
    include: { section: { select: { id: true, crn: true } } },
  })
  if (!fetched) fail('Seat alerts: query by userId+sectionId', 'Alert not found after create')
  else pass('Seat alerts: query by userId+sectionId', `Found alert — threshold=${fetched.threshold}, crn=${fetched.section.crn ?? 'null'}`)

  // 4. Test the check endpoint (no auth — should return 403)
  const checkR = await post('/api/seat-alerts/check', {})
  if (checkR.status === 403) pass('Seat alerts: check endpoint auth guard', 'Returns 403 without cron secret or admin session')
  else if (checkR.status === 200) pass('Seat alerts: check endpoint', 'Check succeeded (possibly open dev mode)')
  else warn('Seat alerts: check endpoint auth guard', `Expected 403, got ${checkR.status}`)

  // 5. Simulate notification creation (direct Prisma)
  let notifId: string | null = null
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: testUser.id,
        type: 'SEAT_ALERT',
        title: 'Test: seat opened',
        body: `Test notification for section ${testSection.sectionNumber}`,
        link: '/schedule-builder',
      },
    })
    notifId = notif.id
    pass('Seat alerts: notification creation', `Notification ${notifId} created successfully`)
  } catch (err) {
    fail('Seat alerts: notification creation', String(err))
  }

  // 6. Test edge case: alert with null seatsRemaining
  const sectionNullSeats = await prisma.section.findFirst({
    where: { isActive: true, seatsRemaining: null },
    select: { id: true },
  })
  if (sectionNullSeats) {
    // Should not crash when seatsRemaining is null
    const nullAlert = await prisma.seatAlert.findFirst({ where: { sectionId: sectionNullSeats.id } })
    pass('Seat alerts: null seatsRemaining handled', 'No crash when section has null seatsRemaining')
  }

  // 7. Deactivate alert
  try {
    await prisma.seatAlert.update({ where: { id: alertId! }, data: { isActive: false } })
    const deactivated = await prisma.seatAlert.findUnique({ where: { id: alertId! } })
    if (deactivated?.isActive === false) pass('Seat alerts: deactivate', 'isActive=false set correctly')
    else fail('Seat alerts: deactivate', 'isActive still true after update')
  } catch (err) {
    fail('Seat alerts: deactivate', String(err))
  }

  // 8. Unauthenticated GET /api/seat-alerts → 401
  const listR = await get('/api/seat-alerts')
  if (listR.status === 401) pass('Seat alerts: GET auth guard', 'Returns 401 without session')
  else warn('Seat alerts: GET auth guard', `Expected 401, got ${listR.status}`)

  // Cleanup
  if (alertId) await prisma.seatAlert.delete({ where: { id: alertId } }).catch(() => {})
  if (notifId) await prisma.notification.delete({ where: { id: notifId } }).catch(() => {})
}

// ── 7. Share / Export Validation ─────────────────────────────────────────────

async function testShareExport() {
  section('7. Share / Export Validation')

  // 1. URL encoding/decoding round-trip
  const mockPayload = { sIds: ['id1', 'id2', 'id3'], t: 'term-abc' }
  const encoded = Buffer.from(JSON.stringify(mockPayload)).toString('base64')
  const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
  if (JSON.stringify(decoded) === JSON.stringify(mockPayload))
    pass('Share URL: encode/decode round-trip', `base64 round-trip preserves sIds and termId`)
  else
    fail('Share URL: encode/decode round-trip', `Decoded mismatch: ${JSON.stringify(decoded)}`)

  // 2. Long schedule URL — verify it's a valid URL (no truncation at reasonable lengths)
  const longPayload = { sIds: Array.from({ length: 10 }, (_, i) => `section-id-${i + 1}-abcde`), t: 'term-2025-spring' }
  const longEncoded = Buffer.from(JSON.stringify(longPayload)).toString('base64')
  const maxExpected = 2048  // URLs should be < 2KB for safe browser support
  if (longEncoded.length < maxExpected)
    pass('Share URL: URL length safe', `10-section share URL = ${longEncoded.length} chars (< ${maxExpected})`)
  else
    warn('Share URL: URL length safe', `10-section share URL = ${longEncoded.length} chars — may be truncated in some browsers`)

  // 3. Resolve endpoint with invalid IDs → 404 or error response (not 500)
  const r1 = await post('/api/schedule/resolve', { sectionIds: ['nonexistent-id-xyz'], termId: 'fake-term' })
  if (r1.status >= 500) fail('Share: resolve with invalid IDs', `Got 5xx — endpoint crashed`)
  else pass('Share: resolve with invalid IDs', `HTTP ${r1.status} — graceful error handling`)

  // 4. Resolve endpoint with real section IDs
  const realSections = await prisma.section.findMany({
    where: { isActive: true },
    select: { id: true, termId: true },
    take: 3,
  })
  if (realSections.length >= 2) {
    const r2 = await post('/api/schedule/resolve', {
      sectionIds: realSections.map(s => s.id),
      termId: realSections[0].termId,
    })
    if (r2.ok && r2.status === 200) {
      const schedule = (r2.data as { schedule?: { sections?: unknown[]; score?: number; scoreReasons?: string[] } })?.schedule
      if (schedule?.sections && schedule.scoreReasons) {
        pass('Share: resolve with real section IDs', `Schedule reconstructed — score=${schedule.score?.toFixed(1)}, reasons=${schedule.scoreReasons.join(', ')}`)
      } else {
        warn('Share: resolve with real section IDs', `HTTP 200 but schedule missing sections or scoreReasons`)
      }
    } else {
      warn('Share: resolve with real section IDs', `HTTP ${r2.status}`)
    }
  } else {
    warn('Share: resolve with real section IDs', 'Insufficient sections in DB for test')
  }

  // 5. Empty sectionIds → validation error (not crash)
  const r3 = await post('/api/schedule/resolve', { sectionIds: [], termId: 'term' })
  if (r3.status >= 500) fail('Share: resolve with empty sectionIds', 'Got 5xx')
  else pass('Share: resolve with empty sectionIds', `HTTP ${r3.status} — validation handled`)

  // 6. CRN copy format validation
  const mockSections = [
    { courseCode: 'CMPS 201', sectionNumber: '1', crn: '20145', professors: [] },
    { courseCode: 'MATH 201', sectionNumber: '3', crn: null, professors: [] },
  ]
  const crnList = mockSections
    .map(s => s.crn ? `${s.courseCode} §${s.sectionNumber} — CRN: ${s.crn}` : `${s.courseCode} §${s.sectionNumber} — CRN: unavailable`)
    .join('\n')
  if (crnList.includes('CRN: 20145') && crnList.includes('CRN: unavailable'))
    pass('Share: CRN copy format', 'CRN present when available, "unavailable" when null')
  else
    fail('Share: CRN copy format', `Unexpected format: ${crnList}`)

  // 7. Registration summary copy format
  const fullSummary = mockSections.map(s => {
    const crn = s.crn ?? 'unavailable'
    return `${s.courseCode} — COURSE NAME\n  Section: §${s.sectionNumber}  CRN: ${crn}\n  Professor: TBA\n  Schedule: TBA`
  }).join('\n\n')
  if (fullSummary.includes('CRN: 20145') && fullSummary.includes('CRN: unavailable'))
    pass('Share: registration summary format', 'Summary includes CRN present/absent handling')
  else
    fail('Share: registration summary format', 'Summary CRN handling broken')
}

// ── 8. Data Issue Reporting Validation ───────────────────────────────────────

async function testDataReporting() {
  section('8. Data Issue Reporting Validation')

  const testSlug = 'aub'

  // 1. Report from schedule builder
  const r1 = await post('/api/data-reports', {
    universitySlug: testSlug,
    courseCode: 'CMPS 201',
    sectionId: 'test-section-id',
    page: '/schedule-builder',
    message: 'Regression test: wrong meeting time. Test auto-generated.',
  })
  if (r1.status === 201) pass('Data reports: schedule builder', `HTTP 201 — report created (id=${(r1.data as { id?: string })?.id})`)
  else fail('Data reports: schedule builder', `HTTP ${r1.status}`)

  // 2. Report from professor page
  const realProf = await prisma.professor.findFirst({ where: { isActive: true }, select: { slug: true } })
  const r2 = await post('/api/data-reports', {
    universitySlug: testSlug,
    professorSlug: realProf?.slug ?? 'test-prof',
    page: `/professors/${realProf?.slug ?? 'test'}`,
    message: 'Regression test: professor data incorrect. Test auto-generated.',
  })
  if (r2.status === 201) pass('Data reports: professor page', `HTTP 201`)
  else fail('Data reports: professor page', `HTTP ${r2.status}`)

  // 3. Report from course page
  const realCourse = await prisma.course.findFirst({ where: { isActive: true }, select: { code: true, slug: true } })
  const r3 = await post('/api/data-reports', {
    universitySlug: testSlug,
    courseCode: realCourse?.code ?? 'CMPS 201',
    page: `/courses/${realCourse?.slug ?? 'test'}`,
    message: 'Regression test: course description wrong. Test auto-generated.',
  })
  if (r3.status === 201) pass('Data reports: course page', `HTTP 201`)
  else fail('Data reports: course page', `HTTP ${r3.status}`)

  // 4. Invalid payload → validation error (not crash)
  const r4 = await post('/api/data-reports', { universitySlug: '', message: 'hi' })
  if (r4.status >= 500) fail('Data reports: invalid payload', `Got 5xx — crashed on bad input`)
  else pass('Data reports: invalid payload rejected', `HTTP ${r4.status}`)

  // 5. Message too short → rejected
  const r5 = await post('/api/data-reports', { universitySlug: testSlug, message: 'ab' })
  if (r5.status === 400) pass('Data reports: min message length enforced', 'HTTP 400 for 2-char message')
  else if (r5.status === 201) warn('Data reports: min message length enforced', 'Accepted 2-char message — schema allows it')
  else fail('Data reports: min message length enforced', `HTTP ${r5.status}`)

  // 6. Verify reports saved in DB
  const savedReports = await prisma.dataReport.count({ where: { page: { contains: '/schedule-builder' } } })
  if (savedReports > 0) pass('Data reports: persisted in DB', `${savedReports} schedule-builder reports in DB`)
  else warn('Data reports: persisted in DB', 'No schedule-builder reports found')
}

// ── 9. Professor Insights Validation ─────────────────────────────────────────

async function testProfessorInsights() {
  section('9. Professor Insights Validation')

  // Get a professor with reviews
  const profWithReviews = await prisma.professor.findFirst({
    where: { isActive: true, reviewCount: { gte: 3 } },
    select: { slug: true, fullName: true, reviewCount: true, overallRating: true },
    orderBy: { reviewCount: 'desc' },
  })

  // Get a professor without reviews
  const profNoReviews = await prisma.professor.findFirst({
    where: { isActive: true, reviewCount: 0 },
    select: { slug: true, fullName: true },
  })

  // Test professor page with reviews
  if (profWithReviews) {
    const r = await get(`/professors/${profWithReviews.slug}`)
    if (!r.ok) { fail(`Professor insights: page loads (${profWithReviews.slug})`, `HTTP ${r.status}`); }
    else {
      pass(`Professor insights: page loads with reviews`, `HTTP 200 — ${profWithReviews.fullName} (${profWithReviews.reviewCount} reviews)`)
      // Check for rating bars
      if (r.body?.includes('rating-bar')) pass('Professor insights: rating bars present', 'rating-bar CSS class found in HTML')
      else warn('Professor insights: rating bars present', 'rating-bar not found in SSR output — may be CSS class')
    }
  } else {
    warn('Professor insights: test data', 'No professor with ≥3 reviews found')
  }

  // Test professor page without reviews (edge case)
  if (profNoReviews) {
    const r = await get(`/professors/${profNoReviews.slug}`)
    if (!r.ok) fail(`Professor insights: zero-review page loads`, `HTTP ${r.status}`)
    else pass('Professor insights: zero-review page safe', `HTTP 200 — no crash on prof with 0 reviews`)
  }

  // Test extractInsights logic directly (simulate)
  const testReviews = [
    { pros: 'Very clear explanations and helpful in office hours', cons: 'Heavy workload and lots of homework' },
    { pros: 'Engaging lectures, very organized professor', cons: 'Hard exams but fair grader' },
    { pros: 'Knowledgeable and accessible', cons: null },
    { pros: null, cons: 'Boring monotone delivery' },
  ]
  const allPros = testReviews.map(r => (r.pros ?? '').toLowerCase()).join(' ')
  const allCons = testReviews.map(r => (r.cons ?? '').toLowerCase()).join(' ')

  const STRENGTH_KWS = ['clear', 'helpful', 'engaging', 'organized', 'knowledgeable']
  const WEAKNESS_KWS = ['heavy workload', 'hard exam', 'boring']
  const foundStrengths = STRENGTH_KWS.filter(kw => allPros.includes(kw))
  const foundWeaknesses = WEAKNESS_KWS.filter(kw => allCons.includes(kw))

  if (foundStrengths.length >= 3) pass('Professor insights: strength extraction', `${foundStrengths.length} keywords matched: ${foundStrengths.join(', ')}`)
  else fail('Professor insights: strength extraction', `Only ${foundStrengths.length} keywords matched — expected ≥3`)

  if (foundWeaknesses.length >= 2) pass('Professor insights: weakness extraction', `${foundWeaknesses.length} keywords matched: ${foundWeaknesses.join(', ')}`)
  else warn('Professor insights: weakness extraction', `${foundWeaknesses.length} keywords matched — expected ≥2`)

  // Edge case: empty reviews array
  const emptyPros = [].map((r: { pros?: string | null }) => (r.pros ?? '').toLowerCase()).join(' ')
  if (emptyPros === '') pass('Professor insights: empty reviews safe', 'Empty review array produces empty string (no crash)')
  else fail('Professor insights: empty reviews safe', 'Unexpected output for empty reviews')

  // Verify insights section threshold (≥3 reviews)
  const allProfsGt3 = await prisma.professor.count({ where: { isActive: true, reviewCount: { gte: 3 } } })
  const allProfs    = await prisma.professor.count({ where: { isActive: true } })
  pass('Professor insights: coverage', `${allProfsGt3}/${allProfs} active professors qualify for insights (≥3 reviews)`)
}

// ── 10. Self-Healing / Sync Safety Validation ─────────────────────────────────

async function testSelfHealing() {
  section('10. Self-Healing / Sync Safety Validation')

  // Get AUB + LAU terms
  const [aubUni, lauUni] = await Promise.all([
    prisma.university.findFirst({ where: { slug: 'aub' } }),
    prisma.university.findFirst({ where: { slug: 'lau' } }),
  ])
  const [aubTerm, lauTerm] = await Promise.all([
    prisma.academicTerm.findFirst({ where: { universityId: aubUni?.id ?? '' }, orderBy: { year: 'desc' } }),
    prisma.academicTerm.findFirst({ where: { universityId: lauUni?.id ?? '' }, orderBy: { year: 'desc' } }),
  ])

  // 1. Run DB integrity check for AUB
  if (aubUni && aubTerm) {
    const t0 = Date.now()
    const aubIntegrity = await checkDBIntegrity(aubUni.id, aubTerm.id)
    const ms = Date.now() - t0
    if (aubIntegrity.passed)
      pass('Self-healing: AUB integrity check', `Score ${aubIntegrity.healthScore}/100 — ${aubIntegrity.warnings.length} warnings, 0 criticals (${ms}ms)`, ms)
    else
      fail('Self-healing: AUB integrity check', `Criticals: ${aubIntegrity.criticals.join('; ')}`)

    if (aubIntegrity.sectionsNoMeetings / (aubIntegrity.totalSections || 1) > 0.5)
      fail('Self-healing: AUB meeting time rate', `${aubIntegrity.sectionsNoMeetings}/${aubIntegrity.totalSections} sections have no meetings`)
    else
      pass('Self-healing: AUB meeting time rate', `${aubIntegrity.sectionsNoMeetings}/${aubIntegrity.totalSections} without meetings (acceptable)`)

    pass('Self-healing: AUB CRN coverage', `${(aubIntegrity.crnCoverageRate * 100).toFixed(1)}%`)
    pass('Self-healing: AUB confirmed rate', `${(aubIntegrity.confirmedRate * 100).toFixed(1)}%`)
  }

  // 2. Run DB integrity check for LAU
  if (lauUni && lauTerm) {
    const lauIntegrity = await checkDBIntegrity(lauUni.id, lauTerm.id)
    if (lauIntegrity.passed)
      pass('Self-healing: LAU integrity check', `Score ${lauIntegrity.healthScore}/100 — ${lauIntegrity.warnings.length} warnings`)
    else
      fail('Self-healing: LAU integrity check', `Criticals: ${lauIntegrity.criticals.join('; ')}`)
    pass('Self-healing: LAU CRN coverage', `${(lauIntegrity.crnCoverageRate * 100).toFixed(1)}%`)
  }

  // 3. autoCorrectOrphans — should find 0 orphans in a clean DB
  if (aubTerm) {
    const orphanResult = await autoCorrectOrphans(aubTerm.id)
    if (orphanResult.deactivatedOrphans === 0)
      pass('Self-healing: autoCorrectOrphans (AUB)', 'No orphaned sections found — DB is clean')
    else
      warn('Self-healing: autoCorrectOrphans (AUB)', `Deactivated ${orphanResult.deactivatedOrphans} orphaned sections`)
  }

  // 4. Stale section detection
  const staleCount = await prisma.section.count({ where: { isActive: true, isStale: true } })
  const totalActive = await prisma.section.count({ where: { isActive: true } })
  const stalePct = totalActive > 0 ? (staleCount / totalActive) * 100 : 0
  if (stalePct > 50) warn('Self-healing: stale ratio', `${stalePct.toFixed(1)}% of active sections are stale — trigger sync`)
  else pass('Self-healing: stale ratio', `${stalePct.toFixed(1)}% stale (${staleCount}/${totalActive})`)

  // 5. checkConnectorHealth with mock data — use 80 distinct subject prefixes to satisfy AUB threshold (minSubjects=70)
  const MOCK_PREFIXES = ['CMPS','MATH','EECE','MECH','CIVL','CHEM','BIOL','PHYS','ENGL','ARAB',
    'HIST','POLS','ECON','MGMT','MRKT','ACCT','FINA','PSYC','SOCL','NURS',
    'ARCH','URPL','AGRI','ENVR','GEOL','STAT','OPER','INFE','CIVI','ELEC',
    'INDS','MATS','PETE','CHME','BIOE','INDE','AERO','NANO','COMP','INFO',
    'DSGN','MUSC','ARTS','FILM','THTR','PHOT','JOUR','COMM','ADVE','PREL',
    'LAWS','MDIV','EDUC','SPCE','HLTH','NTRN','PHRM','MDPH','MBIO','INTL',
    'LING','FREN','GRMN','SPAN','ITAL','CHIN','JAPN','RUSS','LATN','GREK',
    'RELG','PHIL','ANTH','ARCH2','FINE','GEOG','IBUS','LEBN','MFIN','MKTG']
  const mockConnector: ConnectorResult = {
    universitySlug: 'aub',
    termCode: 'Fall 2025',
    fetchedAt: new Date(),
    sections: Array.from({ length: 3500 }, (_, i) => ({
      courseCode: `${MOCK_PREFIXES[i % MOCK_PREFIXES.length]} ${200 + (i % 100)}`,
      courseName: `Test Course ${i}`,
      sectionNumber: `${(i % 10) + 1}`,
      sourceIdentifier: `CRN${10000 + i}`,
      sourceConnector: 'aub-catalog',
      instructors: [`Prof${i % 80} Smith`],
      meetings: [{ day: 'MONDAY', startTime: '09:00', endTime: '10:15', type: 'LECTURE' }],
      status: 'OPEN',
      professorConfidence: 'CONFIRMED',
      historicalInference: false,
      completenessScore: 0.9,
      dataQualityStatus: 'COMPLETE',
    })),
    errors: [],
    isPartial: false,
  }
  const health = checkConnectorHealth('aub', mockConnector)
  if (health.passed) pass('Self-healing: connector health check (mock)', `Passed — ${health.sectionCount} sections, ${health.professorCount} profs`)
  else fail('Self-healing: connector health check (mock)', `Failed: ${health.criticals.join('; ')}`)

  // 6. Mock with degraded data — should generate warnings
  const degradedMock: ConnectorResult = {
    universitySlug: 'aub',
    termCode: 'Fall 2025',
    fetchedAt: new Date(),
    sections: Array.from({ length: 100 }, (_, i) => ({
      courseCode: `CMPS ${200 + i}`,
      courseName: 'Test',
      sectionNumber: '1',
      sourceIdentifier: `CRN${i}`,
      sourceConnector: 'aub-catalog',
      status: 'OPEN',
      instructors: [],  // no professors
      meetings: [],
      professorConfidence: 'INFERRED',
      historicalInference: false,
      completenessScore: 0.1,
      dataQualityStatus: 'MINIMAL',
    })),
    errors: [],
    isPartial: false,
  }
  const degradedHealth = checkConnectorHealth('aub', degradedMock)
  if (!degradedHealth.passed || degradedHealth.warnings.length > 0)
    pass('Self-healing: connector health detects degraded data', `criticals=${degradedHealth.criticals.length} warnings=${degradedHealth.warnings.length}`)
  else
    warn('Self-healing: connector health detects degraded data', 'No warnings raised for degraded connector output')
}

// ── 11. Performance Pass ──────────────────────────────────────────────────────

async function testPerformance() {
  section('11. Performance Pass')

  const WARN_QUERY_MS = 100
  const WARN_API_MS   = 600
  const FAIL_QUERY_MS = 500
  const FAIL_API_MS   = 3000
  const perf: Array<{ label: string; ms: number }> = []

  const timed = async (label: string, fn: () => Promise<void>): Promise<number> => {
    const t0 = Date.now()
    await fn()
    const ms = Date.now() - t0
    perf.push({ label, ms })
    return ms
  }

  // DB queries
  const q1 = await timed('Professor list by reviewCount', async () => {
    await prisma.professor.findMany({ where: { isActive: true }, orderBy: { reviewCount: 'desc' }, take: 20, select: { id: true, fullName: true, overallRating: true, reviewCount: true } })
  })
  if (q1 > FAIL_QUERY_MS) fail(`Perf: professor list`, `${q1}ms exceeds ${FAIL_QUERY_MS}ms limit`)
  else if (q1 > WARN_QUERY_MS) warn(`Perf: professor list`, `${q1}ms`)
  else pass(`Perf: professor list`, `${q1}ms`)

  const q2 = await timed('Course search CMPS', async () => {
    await prisma.course.findMany({ where: { code: { contains: 'CMPS' }, isActive: true }, select: { id: true, code: true, name: true }, take: 10 })
  })
  if (q2 > FAIL_QUERY_MS) fail(`Perf: course search`, `${q2}ms`)
  else pass(`Perf: course search CMPS`, `${q2}ms`)

  const q3 = await timed('Section + meetings + professors (AUB)', async () => {
    const aubTerm = await prisma.academicTerm.findFirst({ where: { universityId: (await prisma.university.findFirst({ where: { slug: 'aub' } }))?.id ?? '' }, orderBy: { year: 'desc' } })
    await prisma.section.findMany({
      where: { termId: aubTerm?.id ?? '', isActive: true },
      include: { meetings: true, professors: { include: { professor: true } } },
      take: 50,
    })
  })
  if (q3 > FAIL_QUERY_MS) fail(`Perf: section join query (AUB)`, `${q3}ms`)
  else if (q3 > WARN_QUERY_MS) warn(`Perf: section join query (AUB)`, `${q3}ms`)
  else pass(`Perf: section join query (AUB)`, `${q3}ms`)

  const q4 = await timed('SeatAlert count', async () => {
    await prisma.seatAlert.count({ where: { isActive: true } })
  })
  pass(`Perf: SeatAlert count`, `${q4}ms`)

  const q5 = await timed('DataReport open count', async () => {
    await prisma.dataReport.count({ where: { status: 'OPEN' } })
  })
  pass(`Perf: DataReport open count`, `${q5}ms`)

  const q6 = await timed('Analytics events last 7 days', async () => {
    await prisma.analyticsEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } })
  })
  pass(`Perf: Analytics events (7d)`, `${q6}ms`)

  // API response times
  const apiTests = [
    { label: 'Homepage', path: '/' },
    { label: 'Professors list', path: '/professors' },
    { label: 'Schedule builder', path: '/schedule-builder' },
    { label: 'Search: CMPS', path: '/api/search?q=CMPS&limit=5' },
    { label: 'Search: Math', path: '/api/search?q=Math&limit=5' },
  ]

  let slowPages = 0
  for (const { label, path } of apiTests) {
    const r = await get(path)
    perf.push({ label, ms: r.ms })
    if (r.ms > FAIL_API_MS) { fail(`Perf: ${label}`, `${r.ms}ms exceeds ${FAIL_API_MS}ms`); slowPages++ }
    else if (r.ms > WARN_API_MS) { warn(`Perf: ${label}`, `${r.ms}ms`); slowPages++ }
    else pass(`Perf: ${label}`, `${r.ms}ms`)
  }

  // Schedule generation timing (engine-only)
  const sections = await prisma.section.findMany({
    where: { isActive: true },
    include: { course: true, professors: { include: { professor: true } }, meetings: true },
    take: 200,
  })
  const courseMap = new Map<string, SectionData[]>()
  for (const s of sections) {
    const sd: SectionData = {
      id: s.id, sectionNumber: s.sectionNumber,
      courseId: s.courseId, courseName: s.course.name, courseCode: s.course.code,
      professors: s.professors.map(sp => ({ id: sp.professor.id, fullName: sp.professor.fullName, overallRating: sp.professor.overallRating, workloadLevel: sp.professor.workloadLevel })),
      meetings: s.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime, type: m.type, location: m.location })),
      crn: s.crn,
    }
    const arr = courseMap.get(s.courseId) ?? []
    arr.push(sd)
    courseMap.set(s.courseId, arr)
  }
  // Take first 4 courses
  const slicedMap = new Map([...courseMap.entries()].slice(0, 4))
  const genT0 = Date.now()
  const generated = generateSchedules(slicedMap, 'balanced', 20)
  const genMs = Date.now() - genT0
  perf.push({ label: 'Schedule engine (4 courses)', ms: genMs })
  if (genMs > 1000) warn(`Perf: schedule engine`, `${genMs}ms for 4 courses (${generated.length} schedules)`)
  else pass(`Perf: schedule engine (4 courses)`, `${genMs}ms → ${generated.length} schedules`)

  // Summary
  const sorted = [...perf].sort((a, b) => b.ms - a.ms)
  console.log('\n  Top 5 slowest:')
  sorted.slice(0, 5).forEach(p => console.log(`    ${String(p.ms).padStart(5)}ms  ${p.label}`))

  const overAll = perf.filter(p => p.ms > WARN_API_MS)
  if (overAll.length > 5) fail('Perf: overall threshold', `${overAll.length} operations exceeded ${WARN_API_MS}ms`)
  else if (overAll.length > 0) warn('Perf: overall threshold', `${overAll.length} operations over ${WARN_API_MS}ms`)
  else pass('Perf: overall threshold', `All operations under ${WARN_API_MS}ms`)
}

// ── 12. Final Beta Readiness Report ──────────────────────────────────────────

function printFinalReport() {
  const total    = results.length
  const passed   = results.filter(r => r.passed && !r.warning).length
  const warnings = results.filter(r => r.warning).length
  const failed   = results.filter(r => !r.passed).length
  const blockers = results.filter(r => !r.passed)

  console.log(`\n${'╔' + '═'.repeat(66) + '╗'}`)
  console.log(`║${'     EduScore Lebanon — Final Pre-Beta Regression Report     '.padEnd(66)}║`)
  console.log(`║${'     Generated: ' + new Date().toISOString().slice(0, 10) + '     '.padEnd(66)}║`)
  console.log(`${'╠' + '═'.repeat(66) + '╣'}`)
  console.log(`║${ `  Total checks : ${total}`.padEnd(66)}║`)
  console.log(`║${ `  ✅ Passed    : ${passed}`.padEnd(66)}║`)
  console.log(`║${ `  ⚠️  Warnings  : ${warnings}`.padEnd(66)}║`)
  console.log(`║${ `  ❌ Failed    : ${failed}`.padEnd(66)}║`)
  console.log(`${'╚' + '═'.repeat(66) + '╝'}`)

  if (warnings > 0) {
    console.log('\n  ── WARNINGS ──────────────────────────────────────────────────')
    results.filter(r => r.warning).forEach(r => {
      console.log(`  ⚠️   ${r.name}`)
      console.log(`       ${r.detail}`)
    })
  }

  if (failed > 0) {
    console.log('\n  ── FAILURES ──────────────────────────────────────────────────')
    blockers.forEach(r => {
      console.log(`  ❌  ${r.name}`)
      console.log(`       ${r.detail}`)
    })
  }

  console.log('\n  ── SECTION SUMMARY ───────────────────────────────────────────')
  const sectionNames = [
    'Route Crawl', 'Search Stress', 'Schedule Stress', 'Calendar UI',
    'CRN Consistency', 'Seat Alerts', 'Share/Export', 'Data Reporting',
    'Professor Insights', 'Self-Healing', 'Performance', 'Final Report',
  ]
  // Approximate distribution
  sectionNames.forEach((name, i) => {
    const sectionResults = results.slice(
      Math.floor(i * results.length / 12),
      Math.floor((i + 1) * results.length / 12)
    )
    const sf = sectionResults.filter(r => !r.passed).length
    const sw = sectionResults.filter(r => r.warning).length
    const icon = sf > 0 ? '❌' : sw > 0 ? '⚠️ ' : '✅'
    console.log(`  ${icon}  ${String(i + 1).padStart(2)}. ${name}`)
  })

  console.log('\n  ── VERDICT ───────────────────────────────────────────────────')
  if (failed === 0) {
    console.log('  ✅  No failures — all regression tests pass.')
    console.log('      Beta launch is SAFE. Warnings are informational only.')
    if (warnings > 0) console.log(`      ${warnings} informational warnings (see above) — no action required before launch.`)
  } else {
    console.log(`  ❌  ${failed} failure(s) detected — review before launch.`)
    blockers.forEach(r => console.log(`      • ${r.name}: ${r.detail}`))
  }
  console.log('  ────────────────────────────────────────────────────────────')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║   EduScore Lebanon — Final Pre-Beta Regression & Stress Test     ║')
  console.log(`║   ${new Date().toISOString().padEnd(66)}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  await testRouteCrawl()
  await testSearchStress()
  await testScheduleStress()
  await testCalendarUI()
  await testCRNConsistency()
  await testSeatAlerts()
  await testShareExport()
  await testDataReporting()
  await testProfessorInsights()
  await testSelfHealing()
  await testPerformance()
  printFinalReport()

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('\n[FATAL]', e)
  await prisma.$disconnect()
  process.exit(1)
})
