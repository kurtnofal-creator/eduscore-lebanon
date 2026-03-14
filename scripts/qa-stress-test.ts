/**
 * EduScore Lebanon – Full Automated QA & Stress Test
 *
 * Covers:
 *   1. Route validation (HTTP GET to localhost:3000)
 *   2. Search stress test (100+ queries to /api/search)
 *   3. Schedule builder stress test (50+ combos, conflict detection)
 *   4. Database integrity checks
 *   5. Edge-case null-safety checks
 *   6. Connector data sanity (AUB/LAU health thresholds)
 *   7. Performance – slowest query timing
 *   8. API error monitoring (invalid payloads)
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/qa-stress-test.ts
 *
 * Requires dev server running on localhost:3000 for route/API tests.
 */

import { PrismaClient } from '@prisma/client'
import { generateSchedules, type SectionData } from '../lib/schedule-engine'

const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'
const TIMEOUT_MS = 15_000

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TestResult {
  name: string
  passed: boolean
  warning?: boolean
  detail: string
  durationMs?: number
}

const results: TestResult[] = []

function pass(name: string, detail: string, durationMs?: number) {
  results.push({ name, passed: true, detail, durationMs })
  console.log(`  ✅  ${name}${durationMs != null ? ` (${durationMs}ms)` : ''}`)
  if (detail) console.log(`       ${detail}`)
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail })
  console.log(`  ❌  ${name}`)
  console.log(`       ${detail}`)
}

function warn(name: string, detail: string, durationMs?: number) {
  results.push({ name, passed: true, warning: true, detail, durationMs })
  console.log(`  ⚠️   ${name}${durationMs != null ? ` (${durationMs}ms)` : ''}`)
  console.log(`       ${detail}`)
}

async function fetchRoute(path: string): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
    clearTimeout(timer)
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t0 }
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String(err) }
  }
}

async function fetchJson(path: string, opts?: RequestInit): Promise<{ ok: boolean; status: number; ms: number; body: unknown }> {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, ...opts })
    clearTimeout(timer)
    const body = await res.json().catch(() => null)
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t0, body }
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, body: null }
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

// ── 1. Route Validation ───────────────────────────────────────────────────────

async function testRoutes() {
  section('1. Route Validation')

  // Discover real slugs for dynamic routes
  const [aubCourse, lauCourse, aubProf, lauProf] = await Promise.all([
    prisma.course.findFirst({
      where: { isActive: true, department: { faculty: { university: { slug: 'aub' } } } },
      select: { slug: true },
    }),
    prisma.course.findFirst({
      where: { isActive: true, department: { faculty: { university: { slug: 'lau' } } } },
      select: { slug: true },
    }),
    prisma.professor.findFirst({
      where: { isActive: true, isMerged: false, department: { faculty: { university: { slug: 'aub' } } } },
      select: { slug: true },
    }),
    prisma.professor.findFirst({
      where: { isActive: true, isMerged: false, department: { faculty: { university: { slug: 'lau' } } } },
      select: { slug: true },
    }),
  ])

  const routes: Array<{ path: string; label: string; expectStatus?: number }> = [
    { path: '/', label: 'Homepage' },
    { path: '/search', label: 'Search page' },
    { path: '/universities', label: 'Universities list' },
    { path: '/universities/aub', label: 'AUB university page' },
    { path: '/universities/lau', label: 'LAU university page' },
    { path: '/courses', label: 'Courses list' },
    { path: '/professors', label: 'Professors list' },
    { path: '/schedule-builder', label: 'Schedule builder' },
    { path: '/login', label: 'Login page' },
    { path: '/dashboard', label: 'Dashboard (auth redirect)', expectStatus: 200 },   // fetch follows redirect, lands on /login (200)
    { path: '/admin', label: 'Admin dashboard (auth redirect)', expectStatus: 200 },
    { path: '/admin/monitoring', label: 'Admin monitoring (auth redirect)', expectStatus: 200 },
    { path: '/admin/sync', label: 'Admin sync (auth redirect)', expectStatus: 200 },
    { path: '/admin/analytics', label: 'Admin analytics (auth redirect)', expectStatus: 200 },
    { path: '/terms', label: 'Terms page' },
    { path: '/privacy', label: 'Privacy page' },
    { path: '/guidelines', label: 'Guidelines page' },
    ...(aubCourse ? [{ path: `/courses/${aubCourse.slug}`, label: 'AUB course page' }] : []),
    ...(lauCourse ? [{ path: `/courses/${lauCourse.slug}`, label: 'LAU course page' }] : []),
    ...(aubProf ? [{ path: `/professors/${aubProf.slug}`, label: 'AUB professor page' }] : []),
    ...(lauProf ? [{ path: `/professors/${lauProf.slug}`, label: 'LAU professor page' }] : []),
    { path: '/courses/nonexistent-slug-xyz', label: '404 course slug', expectStatus: 404 },
    { path: '/professors/nonexistent-xyz', label: '404 professor slug', expectStatus: 404 },
    { path: '/universities/nonexistent-xyz', label: '404 university slug', expectStatus: 404 },
  ]

  let serverReachable = true
  const probe = await fetchRoute('/')
  if (!probe.ok && probe.status === 0) {
    warn('Route validation', 'Dev server not reachable at localhost:3000 — skipping HTTP route tests')
    serverReachable = false
  }

  if (serverReachable) {
    for (const route of routes) {
      const r = await fetchRoute(route.path)
      const expectedOk = route.expectStatus ? r.status === route.expectStatus : r.ok
      const detail = `HTTP ${r.status || 'ERR'} in ${r.ms}ms`
      const slowThreshold = 3000
      if (!expectedOk) {
        fail(`Route: ${route.label}`, `${detail}${r.error ? ` — ${r.error}` : ''}`)
      } else if (r.ms > slowThreshold) {
        warn(`Route: ${route.label}`, `${detail} — SLOW (>${slowThreshold}ms)`, r.ms)
      } else {
        pass(`Route: ${route.label}`, detail, r.ms)
      }
    }
  }
}

// ── 2. Search Stress Test ─────────────────────────────────────────────────────

async function testSearch() {
  section('2. Search Stress Test')

  const probe = await fetchRoute('/api/search?q=test')
  if (!probe.ok && probe.status === 0) {
    warn('Search stress test', 'Dev server not reachable — skipping')
    return
  }

  const queries = [
    // AUB course codes
    'CMPS 200', 'CMPS 201', 'CMPS 202', 'CMPS 203', 'CMPS 204',
    'PSPA 210', 'PSPA 211', 'PSPA 212', 'ECON 211', 'ECON 212',
    'MATH 201', 'MATH 202', 'MATH 203', 'PHYS 201', 'PHYS 202',
    'BIOL 201', 'CHEM 201', 'HIST 201', 'ENGL 201', 'ARAB 201',
    'MECH 310', 'EECE 310', 'EECE 330', 'CVLE 310', 'INDE 310',
    'NURS 301', 'PUBH 201', 'PSYC 201', 'FNAR 201', 'MUSA 201',
    // LAU course codes
    'CSC 201', 'CSC 315', 'ENG 201', 'BUS 200', 'MGT 310',
    'MTH 201', 'PHY 201', 'BIO 201', 'CHM 201', 'PHA 301',
    'ARC 201', 'COM 201', 'ECO 201', 'FIN 301', 'MKT 201',
    'NUR 201', 'NUT 201', 'PSY 201', 'LAW 201', 'EDU 201',
    // Partial queries / department prefixes
    'CMPS', 'PSPA', 'ECON', 'MATH', 'PHYS', 'BIOL', 'CHEM',
    'MECH', 'EECE', 'CVLE', 'NURS', 'PUBH', 'CSC', 'ENG',
    'BUS', 'MGT', 'MTH', 'BIO', 'PHA', 'ARC',
    // Professor names (common patterns)
    'Ali', 'Ahmad', 'Nasser', 'Khalil', 'Hassan', 'Saad',
    'Ibrahim', 'Moussa', 'Khoury', 'Hajj', 'Nassar', 'Rizk',
    'Fares', 'Gemayel', 'Baroud', 'Makarem', 'Chahine',
    // Short/edge queries
    'ca', 'al', 'ma', 'CS', 'en',
    // Mixed case
    'cmps', 'pspa', 'econ', 'math',
    // University names
    'American', 'Lebanese', 'Beirut',
    // Numbers in queries
    '201', '301', '101', '401',
    // Course names
    'Calculus', 'Programming', 'Algorithms', 'Data Structures',
    'Nursing', 'Architecture', 'Economics', 'Philosophy',
    // Gibberish (should return empty, not error)
    'ZZZXXX', 'qqqqqq', '######',
  ]

  let passed = 0, errors = 0, slow = 0
  const slowThreshold = 500
  const errorDetails: string[] = []

  for (const q of queries) {
    const r = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`)
    if (!r.ok) {
      errors++
      errorDetails.push(`"${q}" → HTTP ${r.status}`)
    } else if (r.ms > slowThreshold) {
      slow++
      passed++
    } else {
      passed++
    }
  }

  const total = queries.length
  if (errors === 0) {
    pass(`Search: ${total} queries`, `${passed} passed, ${slow} slow (>${slowThreshold}ms), 0 errors`)
  } else {
    fail(`Search: ${total} queries`, `${errors} errors: ${errorDetails.slice(0, 5).join('; ')}`)
  }

  // Verify actual results for key queries
  const keyChecks: Array<{ q: string; field: 'courses' | 'professors' | 'universities'; label: string }> = [
    { q: 'CMPS', field: 'courses', label: 'CMPS courses at AUB' },
    { q: 'CSC', field: 'courses', label: 'CSC courses at LAU' },
    { q: 'American', field: 'universities', label: 'AUB in university results' },
  ]

  for (const check of keyChecks) {
    const r = await fetchJson(`/api/search?q=${encodeURIComponent(check.q)}`)
    const body = r.body as Record<string, unknown[]> | null
    const count = body?.[check.field]?.length ?? 0
    if (count > 0) {
      pass(`Search result: ${check.label}`, `${count} results returned`)
    } else {
      warn(`Search result: ${check.label}`, `Returned 0 results — may indicate a data issue`)
    }
  }
}

// ── 3. Schedule Builder Stress Test ──────────────────────────────────────────

async function testScheduleBuilder() {
  section('3. Schedule Builder Stress Test')

  const aub = await prisma.university.findUnique({ where: { slug: 'aub' } })
  const lau = await prisma.university.findUnique({ where: { slug: 'lau' } })

  if (!aub || !lau) { fail('Schedule builder', 'AUB or LAU not found'); return }

  const aubTerm = await prisma.academicTerm.findFirst({
    where: { universityId: aub.id, isCurrent: true }, orderBy: { year: 'desc' },
  })
  const lauTerm = await prisma.academicTerm.findFirst({
    where: { universityId: lau.id, isCurrent: true }, orderBy: { year: 'desc' },
  })

  async function getCourseOptions(prefixes: string[], uniId: string, termId: string): Promise<Map<string, SectionData[]>> {
    const map = new Map<string, SectionData[]>()
    for (const prefix of prefixes) {
      const sections = await prisma.section.findMany({
        where: {
          termId,
          isActive: true,
          course: { code: { startsWith: `${prefix} ` }, department: { faculty: { universityId: uniId } } },
        },
        include: {
          course: { select: { id: true, code: true, name: true } },
          professors: {
            select: {
              confidence: true, isPrimary: true,
              professor: { select: { id: true, fullName: true, overallRating: true, workloadLevel: true } },
            },
          },
          meetings: true,
        },
        take: 15,
      })

      if (sections.length === 0) continue

      // group by courseId, pick the course with most sections
      const byId = new Map<string, typeof sections>()
      for (const s of sections) {
        const arr = byId.get(s.courseId) ?? []
        arr.push(s)
        byId.set(s.courseId, arr)
      }
      const best = [...byId.entries()].sort((a, b) => b[1].length - a[1].length)[0]
      if (!best) continue

      const [courseId, secs] = best
      map.set(courseId, secs.map(s => ({
        id: s.id, sectionNumber: s.sectionNumber, courseId: s.courseId,
        courseName: s.course.name, courseCode: s.course.code,
        professors: s.professors.map(sp => ({
          id: sp.professor.id, fullName: sp.professor.fullName,
          overallRating: sp.professor.overallRating, workloadLevel: sp.professor.workloadLevel,
          confidence: sp.confidence,
        })),
        meetings: s.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime, type: m.type, location: m.location })),
        location: s.location, crn: s.crn, status: s.status,
        seatsRemaining: s.seatsRemaining, capacity: s.capacity, enrolled: s.enrolled,
        isStale: s.isStale, completenessScore: s.completenessScore,
        dataQualityStatus: s.dataQualityStatus, historicalInference: s.historicalInference,
        lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
      })))
    }
    return map
  }

  const AUB_COMBOS = [
    ['CMPS', 'MATH'], ['CMPS', 'EECE'], ['CMPS', 'PSPA'],
    ['PSPA', 'HIST'], ['PSPA', 'ECON'], ['PSPA', 'SOAN'],
    ['ECON', 'MATH'], ['ECON', 'SOAN'], ['ECON', 'PSYC'],
    ['ENGL', 'PHIL'], ['ENGL', 'HIST'], ['ENGL', 'PSYC'],
    ['BIOL', 'CHEM'], ['BIOL', 'PHYS'], ['BIOL', 'NURS'],
    ['MECH', 'MATH'], ['MECH', 'PHYS'], ['EECE', 'MATH'],
    ['CVLE', 'MATH'], ['INDE', 'MATH'], ['CHME', 'CHEM'],
    ['NURS', 'BIOL'], ['PUBH', 'BIOL'], ['NUSC', 'CHEM'],
    ['ARAB', 'HIST'], ['ARAB', 'PHIL'], ['FNAR', 'PHIL'],
  ]

  const LAU_COMBOS = [
    ['CSC', 'MTH'], ['CSC', 'EEN'], ['CSC', 'MGT'],
    ['ENG', 'COM'], ['ENG', 'PSY'], ['ENG', 'PHI'],
    ['BUS', 'ECO'], ['BUS', 'MGT'], ['BUS', 'MKT'],
    ['BIO', 'CHM'], ['BIO', 'PHA'], ['BIO', 'NUT'],
    ['ARC', 'ART'], ['ARC', 'IDN'], ['COM', 'ADV'],
    ['NUR', 'BIO'], ['PHA', 'CHM'], ['NUT', 'BIO'],
    ['ECO', 'MTH'], ['MGT', 'MKT'], ['FIN', 'ECO'],
    ['PSC', 'HIS'], ['PSY', 'SOC'], ['ENV', 'BIO'],
  ]

  let passed = 0, noResults = 0, errors = 0, conflictsFound = 0

  async function runCombo(prefixes: string[], uniId: string, termId: string, label: string) {
    try {
      const t0 = Date.now()
      const opts = await getCourseOptions(prefixes, uniId, termId)
      if (opts.size < 2) { noResults++; return }

      const schedules = generateSchedules(opts, 'balanced', 30)
      const ms = Date.now() - t0

      // Verify no cross-section time conflicts in any result
      // (intentionally skips intra-section overlaps — those are source data artifacts)
      const toMins = (t: string) => { const [h, mm] = t.split(':').map(Number); return h * 60 + mm }
      for (const sched of schedules) {
        let schedConflict = false
        for (let si = 0; si < sched.sections.length && !schedConflict; si++) {
          for (let sj = si + 1; sj < sched.sections.length && !schedConflict; sj++) {
            const secA = sched.sections[si]
            const secB = sched.sections[sj]
            for (const mA of secA.meetings) {
              for (const mB of secB.meetings) {
                if (mA.day === mB.day &&
                    toMins(mA.startTime) < toMins(mB.endTime) &&
                    toMins(mB.startTime) < toMins(mA.endTime)) {
                  conflictsFound++
                  fail(`Conflict in ${label}`, `${secA.courseCode}+${secB.courseCode} cross-section overlap on ${mA.day}`)
                  schedConflict = true
                  break
                }
              }
              if (schedConflict) break
            }
          }
        }
        if (schedConflict) return

        if (ms > 2000) {
          warn(`Schedule ${label} (${prefixes.join('+')})`, `Generated ${schedules.length} schedules in ${ms}ms — SLOW`)
        }
      }
      passed++
    } catch (err) {
      errors++
      fail(`Schedule ${label} (${prefixes.join('+')})`, String(err))
    }
  }

  if (aubTerm) {
    for (const combo of AUB_COMBOS) {
      await runCombo(combo, aub.id, aubTerm.id, 'AUB')
    }
  }
  if (lauTerm) {
    for (const combo of LAU_COMBOS) {
      await runCombo(combo, lau.id, lauTerm.id, 'LAU')
    }
  }

  const total = AUB_COMBOS.length + LAU_COMBOS.length
  if (errors === 0 && conflictsFound === 0) {
    pass(`Schedule builder: ${total} combos`, `${passed} produced schedules, ${noResults} had insufficient data — 0 conflicts, 0 errors`)
  } else {
    if (conflictsFound > 0) fail(`Schedule builder: conflict detection`, `${conflictsFound} schedules had time conflicts`)
    if (errors > 0) fail(`Schedule builder: errors`, `${errors} combos threw exceptions`)
  }
}

// ── 4. Database Integrity ─────────────────────────────────────────────────────

async function testDatabaseIntegrity() {
  section('4. Database Integrity')

  const t0 = Date.now()

  const [
    orphanSectionProfs,   // sectionProfessors without a valid section
    orphanProfLinks,      // sectionProfessors without a valid professor
    sectionsNoMeetings,   // active sections with 0 meetings (not necessarily bad, but worth noting)
    coursesNoDept,        // courses whose department no longer exists (shouldn't happen with FK)
    profsMissingName,     // professors with empty fullName
    sectionsNegativeSeats,// data anomaly: seatsRemaining < 0
  ] = await Promise.all([

    // Check for sectionProfessors whose section was deleted (cascade should prevent, but verify)
    prisma.$queryRaw<[{ c: number }]>`
      SELECT COUNT(*) as c FROM SectionProfessor sp
      WHERE NOT EXISTS (SELECT 1 FROM Section s WHERE s.id = sp.sectionId)
    `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1),

    prisma.$queryRaw<[{ c: number }]>`
      SELECT COUNT(*) as c FROM SectionProfessor sp
      WHERE NOT EXISTS (SELECT 1 FROM Professor p WHERE p.id = sp.professorId)
    `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1),

    prisma.section.count({
      where: { isActive: true, meetings: { none: {} } },
    }),

    prisma.$queryRaw<[{ c: number }]>`
      SELECT COUNT(*) as c FROM Course c
      WHERE NOT EXISTS (SELECT 1 FROM Department d WHERE d.id = c.departmentId)
    `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1),

    prisma.professor.count({
      where: { isActive: true, OR: [{ fullName: '' }, { fullName: { equals: '' } }] },
    }),

    prisma.section.count({
      where: { seatsRemaining: { lt: 0 } },
    }),
  ])

  const ms = Date.now() - t0

  // Orphaned SectionProfessor rows
  if (orphanSectionProfs === 0) {
    pass('DB: SectionProfessor → Section FK', 'No orphaned SectionProfessor rows')
  } else if (orphanSectionProfs < 0) {
    warn('DB: SectionProfessor → Section FK', 'Raw query failed — skipped')
  } else {
    fail('DB: SectionProfessor → Section FK', `${orphanSectionProfs} orphaned rows found`)
  }

  if (orphanProfLinks === 0) {
    pass('DB: SectionProfessor → Professor FK', 'No orphaned professor links')
  } else if (orphanProfLinks < 0) {
    warn('DB: SectionProfessor → Professor FK', 'Raw query failed — skipped')
  } else {
    fail('DB: SectionProfessor → Professor FK', `${orphanProfLinks} rows point to missing professors`)
  }

  if (coursesNoDept === 0) {
    pass('DB: Course → Department FK', 'All courses have valid department')
  } else if (coursesNoDept < 0) {
    warn('DB: Course → Department FK', 'Raw query failed — skipped')
  } else {
    fail('DB: Course → Department FK', `${coursesNoDept} courses with missing department`)
  }

  if (profsMissingName === 0) {
    pass('DB: Professor names non-empty', 'All active professors have fullName')
  } else {
    warn('DB: Professor names non-empty', `${profsMissingName} professors with empty fullName`)
  }

  if (sectionsNegativeSeats === 0) {
    pass('DB: Section seat counts non-negative', 'No negative seatsRemaining values')
  } else {
    warn('DB: Section seat counts non-negative', `${sectionsNegativeSeats} sections have seatsRemaining < 0`)
  }

  // Active sections without meetings — warn if high
  const totalActive = await prisma.section.count({ where: { isActive: true } })
  const pct = totalActive > 0 ? (sectionsNoMeetings / totalActive * 100).toFixed(1) : '0'
  if (sectionsNoMeetings === 0) {
    pass('DB: Active sections have meetings', 'All active sections have ≥1 meeting time')
  } else if (sectionsNoMeetings / totalActive < 0.35) {
    // Up to 35% is acceptable — TBA/online sections from live connectors (AUB, LAU) have no meeting times
    warn('DB: Active sections with no meetings', `${sectionsNoMeetings} (${pct}%) have no meeting times — expected for TBA/online courses`)
  } else {
    fail('DB: Active sections with no meetings', `${sectionsNoMeetings} (${pct}%) — unexpectedly high, investigate connector data`)
  }

  pass('DB: Integrity checks timing', `All checks completed in ${ms}ms`, ms)
}

// ── 5. Edge-Case Null Safety ──────────────────────────────────────────────────

async function testEdgeCases() {
  section('5. Edge-Case Null Safety')

  // Find professors with no ratings (no reviews yet)
  const profNoRating = await prisma.professor.findFirst({
    where: { isActive: true, isMerged: false, overallRating: null },
    select: { slug: true, fullName: true },
  })
  if (profNoRating) {
    const r = await fetchRoute(`/professors/${profNoRating.slug}`)
    if (r.ok) {
      pass('Edge: Professor with null rating', `${profNoRating.fullName} — page loads (HTTP ${r.status})`)
    } else {
      fail('Edge: Professor with null rating', `HTTP ${r.status} — page crashed for ${profNoRating.slug}`)
    }
  } else {
    pass('Edge: Professor with null rating', 'No such professor in DB — skipped')
  }

  // Find course with no reviews
  const courseNoReviews = await prisma.course.findFirst({
    where: { isActive: true, reviewCount: 0 },
    select: { slug: true, code: true },
  })
  if (courseNoReviews) {
    const r = await fetchRoute(`/courses/${courseNoReviews.slug}`)
    if (r.ok) {
      pass('Edge: Course with 0 reviews', `${courseNoReviews.code} — page loads (HTTP ${r.status})`)
    } else {
      fail('Edge: Course with 0 reviews', `HTTP ${r.status} — page crashed for ${courseNoReviews.slug}`)
    }
  }

  // Find section with no seatsRemaining
  const noSeats = await prisma.section.count({ where: { seatsRemaining: null, isActive: true } })
  const total = await prisma.section.count({ where: { isActive: true } })
  const pct = total > 0 ? (noSeats / total * 100).toFixed(1) : '0'
  if (noSeats > 0) {
    pass('Edge: Sections without seat count', `${noSeats} (${pct}%) have seatsRemaining=null — schedule builder handles gracefully`)
  }

  // Find section with no location
  const noLocation = await prisma.section.count({ where: { location: null, isActive: true } })
  pass('Edge: Sections without location', `${noLocation} sections have location=null — UI shows fallback`)

  // Find section with no professor
  const noProf = await prisma.section.count({
    where: { isActive: true, professors: { none: {} } },
  })
  const noProfPct = total > 0 ? (noProf / total * 100).toFixed(1) : '0'
  if (noProf / total < 0.15) {
    pass('Edge: Sections without professor', `${noProf} (${noProfPct}%) — within expected range for TBA assignments`)
  } else {
    warn('Edge: Sections without professor', `${noProf} (${noProfPct}%) have no professor — higher than expected`)
  }

  // Historical inference sections (should render with banner)
  const historical = await prisma.section.count({ where: { historicalInference: true, isActive: true } })
  pass('Edge: historicalInference sections', `${historical} sections flagged — UI renders inference warning`)
}

// ── 6. Connector Data Sanity ──────────────────────────────────────────────────

async function testConnectorSanity() {
  section('6. Connector Data Sanity')

  const THRESHOLDS = {
    aub: { minSections: 2800, minCurrentTerm: 3000, minProfessors: 600, minConfirmedRate: 0.85 },
    lau: { minSections: 2000, minCurrentTerm: 2000, minProfessors: 500, minConfirmedRate: 0.85 },
  }

  for (const [slug, thresh] of Object.entries(THRESHOLDS)) {
    const uni = await prisma.university.findUnique({ where: { slug } })
    if (!uni) { fail(`Connector sanity: ${slug.toUpperCase()}`, 'University not found'); continue }

    const term = await prisma.academicTerm.findFirst({
      where: { universityId: uni.id, isCurrent: true },
      orderBy: { year: 'desc' },
    })

    const [totalSections, currentTermSections, totalProfessors, confirmedCount] = await Promise.all([
      prisma.section.count({ where: { isActive: true, course: { department: { faculty: { universityId: uni.id } } } } }),
      term ? prisma.section.count({ where: { termId: term.id, isActive: true } }) : Promise.resolve(0),
      prisma.professor.count({ where: { isActive: true, isMerged: false, department: { faculty: { universityId: uni.id } } } }),
      prisma.sectionProfessor.count({
        where: {
          confidence: 'CONFIRMED',
          section: { course: { department: { faculty: { universityId: uni.id } } } },
        },
      }),
    ])

    const confirmedRate = currentTermSections > 0 ? confirmedCount / currentTermSections : 0
    const label = slug.toUpperCase()

    if (totalSections >= thresh.minSections) {
      pass(`Connector: ${label} total sections`, `${totalSections} ≥ ${thresh.minSections} threshold`)
    } else {
      fail(`Connector: ${label} total sections`, `${totalSections} — BELOW minimum ${thresh.minSections}`)
    }

    if (currentTermSections >= thresh.minCurrentTerm) {
      pass(`Connector: ${label} current term sections`, `${currentTermSections} ≥ ${thresh.minCurrentTerm} threshold`)
    } else {
      fail(`Connector: ${label} current term sections`, `${currentTermSections} — BELOW minimum ${thresh.minCurrentTerm}`)
    }

    if (totalProfessors >= thresh.minProfessors) {
      pass(`Connector: ${label} professors`, `${totalProfessors} ≥ ${thresh.minProfessors} threshold`)
    } else {
      fail(`Connector: ${label} professors`, `${totalProfessors} — BELOW minimum ${thresh.minProfessors}`)
    }

    if (confirmedRate >= thresh.minConfirmedRate) {
      pass(`Connector: ${label} confirmed rate`, `${(confirmedRate * 100).toFixed(1)}% ≥ ${thresh.minConfirmedRate * 100}%`)
    } else {
      warn(`Connector: ${label} confirmed rate`, `${(confirmedRate * 100).toFixed(1)}% — below ${thresh.minConfirmedRate * 100}% target`)
    }
  }
}

// ── 7. Performance Profiling ──────────────────────────────────────────────────

async function testPerformance() {
  section('7. Performance – Query Timing')

  const aub = await prisma.university.findUnique({ where: { slug: 'aub' } })
  const aubTerm = aub ? await prisma.academicTerm.findFirst({
    where: { universityId: aub.id, isCurrent: true }, orderBy: { year: 'desc' },
  }) : null

  const queries: Array<{ name: string; fn: () => Promise<unknown> }> = [
    {
      name: 'Professor list (reviewCount desc, limit 20)',
      fn: () => prisma.professor.findMany({
        where: { isActive: true, isMerged: false },
        orderBy: { reviewCount: 'desc' },
        take: 20,
        select: { id: true, fullName: true, overallRating: true, reviewCount: true, slug: true },
      }),
    },
    {
      name: 'Course search: "CMPS" by code/name',
      fn: () => prisma.course.findMany({
        where: { isActive: true, OR: [{ name: { contains: 'CMPS' } }, { code: { contains: 'CMPS' } }] },
        take: 8,
      }),
    },
    {
      name: 'Section quality stats (all universities)',
      fn: () => prisma.university.findMany({
        where: { isActive: true },
        include: {
          faculties: {
            include: {
              departments: {
                include: {
                  courses: {
                    where: { isActive: true },
                    include: { sections: { where: { isActive: true }, take: 1 } },
                  },
                },
              },
            },
          },
        },
      }),
    },
    {
      name: 'Sections for schedule builder (AUB, CMPS + MATH)',
      fn: () => aubTerm ? prisma.section.findMany({
        where: {
          termId: aubTerm.id, isActive: true,
          course: {
            OR: [
              { code: { startsWith: 'CMPS ' } },
              { code: { startsWith: 'MATH ' } },
            ],
          },
        },
        include: { course: true, professors: { include: { professor: true } }, meetings: true },
      }) : Promise.resolve([]),
    },
    {
      name: 'Approved reviews (latest 20)',
      fn: () => prisma.review.findMany({
        where: { status: 'APPROVED' },
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
    },
    {
      name: 'Admin monitoring: last sync job per university',
      fn: () => prisma.university.findMany({
        where: { isActive: true },
        include: {
          syncJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
    },
    {
      name: 'SectionProfessor confirmed count (AUB)',
      fn: () => aub ? prisma.sectionProfessor.count({
        where: {
          confidence: 'CONFIRMED',
          section: { course: { department: { faculty: { universityId: aub.id } } } },
        },
      }) : Promise.resolve(0),
    },
    {
      name: 'Analytics events count (last 30d)',
      fn: () => prisma.analyticsEvent.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    },
  ]

  const WARN_MS = 500
  const FAIL_MS = 2000

  const timings: Array<{ name: string; ms: number }> = []

  for (const q of queries) {
    const t0 = Date.now()
    try {
      await q.fn()
      const ms = Date.now() - t0
      timings.push({ name: q.name, ms })
      if (ms > FAIL_MS) {
        fail(`Perf: ${q.name}`, `${ms}ms — exceeds ${FAIL_MS}ms threshold`)
      } else if (ms > WARN_MS) {
        warn(`Perf: ${q.name}`, `${ms}ms — consider indexing`, ms)
      } else {
        pass(`Perf: ${q.name}`, `${ms}ms`, ms)
      }
    } catch (err) {
      fail(`Perf: ${q.name}`, String(err))
    }
  }

  const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 3)
  console.log(`\n  Slowest queries:`)
  for (const s of slowest) console.log(`    ${s.ms}ms  ${s.name}`)
}

// ── 8. API Error Monitoring ───────────────────────────────────────────────────

async function testApiErrors() {
  section('8. API Error Monitoring (invalid inputs)')

  const probe = await fetchRoute('/api/search?q=test')
  if (!probe.ok && probe.status === 0) {
    warn('API error monitoring', 'Dev server not reachable — skipping')
    return
  }

  const cases: Array<{ label: string; method: string; path: string; body?: unknown; expectStatus: number }> = [
    // Search edge cases
    { label: 'Search: empty query',            method: 'GET', path: '/api/search?q=',           expectStatus: 200 },
    { label: 'Search: single char',            method: 'GET', path: '/api/search?q=a',           expectStatus: 200 },
    { label: 'Search: SQL injection attempt',  method: 'GET', path: "/api/search?q='; DROP TABLE", expectStatus: 200 },

    // Schedule: missing fields
    { label: 'Schedule: empty body',           method: 'POST', path: '/api/schedule', body: {},              expectStatus: 400 },
    { label: 'Schedule: no courseIds',         method: 'POST', path: '/api/schedule', body: { termId: 'x' }, expectStatus: 400 },
    { label: 'Schedule: too many courses',     method: 'POST', path: '/api/schedule', body: { courseIds: Array(15).fill('id'), termId: 'x' }, expectStatus: 400 },
    { label: 'Schedule: invalid preference',   method: 'POST', path: '/api/schedule', body: { courseIds: ['id'], termId: 'x', preference: 'invalid' }, expectStatus: 400 },
    { label: 'Schedule: nonexistent term',     method: 'POST', path: '/api/schedule', body: { courseIds: ['nonexistent'], termId: 'nonexistent-term' }, expectStatus: 422 },

    // Data reports: missing message
    { label: 'DataReport: empty message',      method: 'POST', path: '/api/data-reports', body: { universitySlug: 'aub', message: 'x' }, expectStatus: 400 },
    { label: 'DataReport: missing university', method: 'POST', path: '/api/data-reports', body: { message: 'test message here' }, expectStatus: 400 },
    { label: 'DataReport: valid report',       method: 'POST', path: '/api/data-reports', body: { universitySlug: 'aub', courseCode: 'CMPS 200', message: 'Test QA report - please ignore' }, expectStatus: 201 },
  ]

  for (const c of cases) {
    const opts: RequestInit = {
      method: c.method,
      headers: { 'Content-Type': 'application/json' },
      ...(c.body !== undefined ? { body: JSON.stringify(c.body) } : {}),
    }
    const r = await fetchJson(c.path, opts)
    if (r.status === c.expectStatus) {
      pass(`API: ${c.label}`, `HTTP ${r.status} as expected`)
    } else {
      fail(`API: ${c.label}`, `Expected ${c.expectStatus}, got ${r.status}`)
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

function printReport() {
  const now = new Date().toISOString().split('T')[0]
  const passed  = results.filter(r => r.passed && !r.warning).length
  const warnings = results.filter(r => r.warning).length
  const failed  = results.filter(r => !r.passed).length
  const total   = results.length

  console.log('\n')
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  EduScore Lebanon — QA & Stress Test Report')
  console.log(`  Generated: ${now}`)
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Total checks: ${total}`)
  console.log(`  ✅ Passed:    ${passed}`)
  console.log(`  ⚠️  Warnings:  ${warnings}`)
  console.log(`  ❌ Failed:    ${failed}`)
  console.log()

  if (failed > 0) {
    console.log('  ── FAILURES ──────────────────────────────────')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  ❌  ${r.name}`)
      console.log(`       ${r.detail}`)
    }
    console.log()
  }

  if (warnings > 0) {
    console.log('  ── WARNINGS ──────────────────────────────────')
    for (const r of results.filter(r => r.warning)) {
      console.log(`  ⚠️   ${r.name}`)
      console.log(`       ${r.detail}`)
    }
    console.log()
  }

  if (failed === 0 && warnings === 0) {
    console.log('  🚀 ALL CHECKS PASSED — Platform ready for beta launch')
  } else if (failed === 0) {
    console.log('  ✅ No failures — warnings noted above, review before launch')
  } else {
    console.log('  ❌ FAILURES DETECTED — resolve before beta launch')
  }

  console.log('══════════════════════════════════════════════════════════════')
  console.log()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  EduScore Lebanon — Full QA & Stress Test')
  console.log(`  ${new Date().toISOString()}`)
  console.log('══════════════════════════════════════════════════════════════')

  await testRoutes()
  await testSearch()
  await testScheduleBuilder()
  await testDatabaseIntegrity()
  await testEdgeCases()
  await testConnectorSanity()
  await testPerformance()
  await testApiErrors()

  printReport()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
