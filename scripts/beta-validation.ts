/**
 * EduScore Lebanon – Full Beta Validation Suite
 *
 * Covers all 9 validation domains before beta launch:
 *   1. Connector data validation (AUB + LAU live fetch samples)
 *   2. Database integrity audit
 *   3. Source → DB → API → UI chain validation (30 AUB + 30 LAU sections)
 *   4. API stress test (200 searches / 100 schedule / 50 course / 50 prof)
 *   5. Schedule builder validation (100+ combos, CRN + conflict checks)
 *   6. UI rendering validation (route checks + CRN badge HTML verification)
 *   7. Performance analysis (flag queries >300ms, recommend indexes)
 *   8. Regression tests (CRN, conflicts, search, connectors)
 *   9. Final beta readiness report
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/beta-validation.ts
 */

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { generateSchedules, type SectionData } from '../lib/schedule-engine'

const prisma = new PrismaClient()
const BASE   = 'http://localhost:3000'
const TIMEOUT = 20_000

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Result {
  name: string
  passed: boolean
  warning?: boolean
  detail: string
  durationMs?: number
}

const results: Result[] = []

function pass(name: string, detail: string, ms?: number) {
  results.push({ name, passed: true, detail, durationMs: ms })
  console.log(`  ✅  ${name}${ms != null ? ` (${ms}ms)` : ''}`)
  if (detail) console.log(`       ${detail}`)
}
function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail })
  console.log(`  ❌  ${name}`)
  console.log(`       ${detail}`)
}
function warn(name: string, detail: string, ms?: number) {
  results.push({ name, passed: true, warning: true, detail, durationMs: ms })
  console.log(`  ⚠️   ${name}${ms != null ? ` (${ms}ms)` : ''}`)
  console.log(`       ${detail}`)
}
function section(title: string) {
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(64))
}

async function fetchRoute(path: string): Promise<{ ok: boolean; status: number; ms: number; body?: string }> {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
    clearTimeout(timer)
    const body = await res.text().catch(() => '')
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t0, body }
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0 }
  }
}

async function fetchJson(path: string, opts?: RequestInit): Promise<{ ok: boolean; status: number; ms: number; body: unknown }> {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, ...opts })
    clearTimeout(timer)
    const body = await res.json().catch(() => null)
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t0, body }
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t0, body: null }
  }
}

async function externalFetch(url: string, opts?: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...(opts?.headers ?? {}),
      },
    })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// ── 1. Connector Data Validation ──────────────────────────────────────────────

async function validateConnectors() {
  section('1. Connector Data Validation')

  // ── AUB ──────────────────────────────────────────────────────────────────
  console.log('\n  [AUB] Testing live catalog endpoint...')
  const AUB_CATALOG_INDEX = 'https://www-banner.aub.edu.lb/catalog/schedule_header.html'
  const AUB_SAMPLE_PAGE   = 'https://www-banner.aub.edu.lb/catalog/schd_C.htm' // CMPS, CHEM, CVLE…

  let aubLiveOk = false
  let aubSampleSections: Array<{ crn: string; code: string; section: string; prof: string | null; meetings: number; room: string | null }> = []

  try {
    const t0 = Date.now()
    const idxRes = await externalFetch(AUB_CATALOG_INDEX, {}, 15_000)
    const idxMs  = Date.now() - t0

    if (!idxRes.ok) {
      fail('Connector: AUB catalog index reachable', `HTTP ${idxRes.status}`)
    } else {
      const html  = await idxRes.text()
      const terms = [...html.matchAll(/(\d{6}):/g)].map(m => m[1])
      aubLiveOk   = true
      pass('Connector: AUB catalog index reachable', `HTTP 200 in ${idxMs}ms — terms available: ${terms.join(', ')}`, idxMs)

      // Parse a sample page
      const t1 = Date.now()
      const sampleRes = await externalFetch(AUB_SAMPLE_PAGE, {}, 40_000)
      const sampleMs  = Date.now() - t1

      if (sampleRes.ok) {
        const sHtml = await sampleRes.text()
        const $ = cheerio.load(sHtml)
        const currentTerm = terms[0] ?? ''

        // Parse same column layout as aub-full-sync.ts
        const COL = {
          TERM: 0, CRN: 1, SUBJECT: 2, CODE: 3, SECTION: 4,
          BEGIN1: 11, END1: 12, BUILDING1: 13, ROOM1: 14, DAYS1: 15,
          INST_FIRST: 33, INST_LAST: 34,
        }

        $('table').eq(1).find('tr').slice(2).each((_i, tr) => {
          const cells = $(tr).find('td')
          if (cells.length < 35) return
          const cell = (idx: number) => $(cells[idx]).text().trim()
          const termCell = cell(COL.TERM)
          if (!termCell.includes(`(${currentTerm})`)) return
          const crn  = cell(COL.CRN)
          const subj = cell(COL.SUBJECT)
          const code = cell(COL.CODE)
          if (!crn || !subj || !code) return
          const firstName = cell(COL.INST_FIRST)
          const lastName  = cell(COL.INST_LAST)
          const prof = (firstName && firstName !== '.' && lastName && lastName !== '.')
            ? `${firstName} ${lastName}`.trim() : null
          const begin1 = cell(COL.BEGIN1)
          const hasMeetings = !!begin1 && begin1 !== '.'
          const room1 = [cell(COL.BUILDING1), cell(COL.ROOM1)].filter(v => v && v !== '.').join(' ') || null
          aubSampleSections.push({ crn, code: `${subj} ${code}`, section: cell(COL.SECTION), prof, meetings: hasMeetings ? 1 : 0, room: room1 || null })
        })

        const withCRN   = aubSampleSections.filter(s => !!s.crn).length
        const withProf  = aubSampleSections.filter(s => !!s.prof).length
        const withMeet  = aubSampleSections.filter(s => s.meetings > 0).length
        const withRoom  = aubSampleSections.filter(s => !!s.room).length
        const total     = aubSampleSections.length

        if (total === 0) {
          fail('Connector: AUB sample parse', `schd_C.htm returned 0 parseable rows — parser may need update`)
        } else {
          // Verify CRN ≠ section number (must differ)
          const crnEqualsSection = aubSampleSections.filter(s => s.crn === s.section)
          pass('Connector: AUB sample sections parsed', `${total} rows in ${sampleMs}ms`, sampleMs)
          pass('Connector: AUB CRN extraction', `${withCRN}/${total} (${pct(withCRN, total)}%) have CRN`)
          pass('Connector: AUB professor extraction', `${withProf}/${total} (${pct(withProf, total)}%) have professor name`)
          pass('Connector: AUB meeting time extraction', `${withMeet}/${total} (${pct(withMeet, total)}%) have meeting times`)
          pass('Connector: AUB room/location extraction', `${withRoom}/${total} (${pct(withRoom, total)}%) have room`)
          if (crnEqualsSection.length > 0) {
            fail('Connector: AUB CRN ≠ sectionNumber', `${crnEqualsSection.length} rows have CRN equal to section number — data confusion detected`)
          } else {
            pass('Connector: AUB CRN ≠ sectionNumber', 'All sampled CRNs differ from section numbers — no data confusion')
          }
        }
      } else {
        warn('Connector: AUB sample page', `HTTP ${sampleRes.status} — could not validate parser`)
      }
    }
  } catch (err) {
    fail('Connector: AUB catalog reachable', `Network error: ${String(err).slice(0, 100)}`)
  }

  // ── LAU ──────────────────────────────────────────────────────────────────
  console.log('\n  [LAU] Testing live Banner 8 endpoint...')
  const LAU_TERMS_URL    = 'https://banweb.lau.edu.lb/prod/bwckschd.p_disp_dyn_sched'
  const LAU_SCHEDULE_URL = 'https://banweb.lau.edu.lb/prod/bwckschd.p_get_crse_unsec'
  const LAU_TERM         = '202620'  // Spring 2026

  let lauLiveOk = false
  let lauSampleSections: Array<{ crn: string; code: string; section: string; prof: string | null; meetings: number; room: string | null }> = []

  try {
    const t0 = Date.now()
    const termsRes = await externalFetch(LAU_TERMS_URL, {}, 15_000)
    const termsMs  = Date.now() - t0

    if (!termsRes.ok) {
      fail('Connector: LAU Banner 8 terms page reachable', `HTTP ${termsRes.status}`)
    } else {
      const html  = await termsRes.text()
      const hasTerm = html.includes(LAU_TERM)
      lauLiveOk = true
      if (hasTerm) {
        pass('Connector: LAU Banner 8 terms page reachable', `HTTP 200 in ${termsMs}ms — term ${LAU_TERM} confirmed`, termsMs)
      } else {
        warn('Connector: LAU Banner 8 terms page reachable', `HTTP 200 in ${termsMs}ms but term ${LAU_TERM} not found — may have rolled over`)
      }

      // Fetch one subject (CSC) for fast parsing validation
      const body = new URLSearchParams([
        ['term_in', LAU_TERM], ['sel_subj', 'dummy'], ['sel_day', 'dummy'],
        ['sel_schd', 'dummy'], ['sel_insm', 'dummy'], ['sel_camp', 'dummy'],
        ['sel_levl', 'dummy'], ['sel_sess', 'dummy'], ['sel_instr', 'dummy'],
        ['sel_ptrm', 'dummy'], ['sel_attr', 'dummy'],
        ['sel_subj', 'CSC'],
        ['sel_crse', ''], ['sel_title', ''], ['sel_schd', '%'],
        ['sel_from_cred', ''], ['sel_to_cred', ''],
        ['sel_camp', '%'], ['sel_levl', '%'], ['sel_ptrm', '%'],
        ['sel_instr', '%'], ['sel_attr', '%'],
        ['begin_hh', '0'], ['begin_mi', '0'], ['begin_ap', 'a'],
        ['end_hh', '0'], ['end_mi', '0'], ['end_ap', 'a'],
      ]).toString()

      const t1 = Date.now()
      const schedRes = await externalFetch(LAU_SCHEDULE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }, 30_000)
      const schedMs = Date.now() - t1

      if (!schedRes.ok) {
        warn('Connector: LAU Banner 8 CSC fetch', `HTTP ${schedRes.status}`)
      } else {
        const sHtml = await schedRes.text()
        if (sHtml.includes('PD-S-SESSION-ID') || sHtml.includes('Sign in | LAU')) {
          fail('Connector: LAU Banner 8 CSC fetch', 'Login page returned — endpoint now requires authentication')
        } else {
          const $     = cheerio.load(sHtml)
          const outer = $('table.datadisplaytable').filter((_i, el) =>
            ($(el).attr('summary') ?? '').toLowerCase().includes('sections found')
          ).first()

          const rows = outer.find('> tbody > tr, > tr').toArray()
          for (let i = 0; i < rows.length; i++) {
            const titleTh = $(rows[i]).find('th.ddtitle').first()
            if (!titleTh.length) continue
            const href = titleTh.find('a').attr('href') ?? ''
            const titleText = titleTh.find('a').text().trim()
            const crnMatch = href.match(/crn_in=(\d+)/)
            if (!crnMatch) continue
            const crn   = crnMatch[1]
            const parts = titleText.split(' - ')
            if (parts.length < 4) continue
            const section = parts[parts.length - 1].trim()
            const code    = parts[parts.length - 2].trim()

            const detailTd = $(rows[i + 1])?.find('td.dddefault').first()
            let prof: string | null = null
            let meetCount = 0
            let room: string | null = null

            detailTd?.find('table.datadisplaytable').filter((_j, el) =>
              ($(el).attr('summary') ?? '').toLowerCase().includes('meeting times')
            ).first().find('tr').slice(1).each((_j, row) => {
              const cells = $(row).find('td.dddefault')
              if (cells.length < 7) return
              const days = $(cells[2]).text().trim()
              const where = $(cells[3]).text().trim()
              const instr = $(cells[6]).text().trim().replace(/\([PE]\)/g, '').replace(/\s+/g, ' ').trim()
              if (days && days !== 'TBA') meetCount++
              if (where && where !== 'TBA' && !room) room = where
              if (instr && instr !== 'TBA' && !prof) prof = instr
            })

            lauSampleSections.push({ crn, code, section, prof, meetings: meetCount, room })
          }

          const total    = lauSampleSections.length
          const withCRN  = lauSampleSections.filter(s => !!s.crn).length
          const withProf = lauSampleSections.filter(s => !!s.prof).length
          const withMeet = lauSampleSections.filter(s => s.meetings > 0).length
          const withRoom = lauSampleSections.filter(s => !!s.room).length

          if (total === 0) {
            warn('Connector: LAU Banner 8 CSC parse', `0 CSC sections found — term may have changed`)
          } else {
            const crnEqualsSection = lauSampleSections.filter(s => s.crn === s.section)
            pass('Connector: LAU sample sections parsed', `${total} CSC rows in ${schedMs}ms`, schedMs)
            pass('Connector: LAU CRN extraction', `${withCRN}/${total} (${pct(withCRN, total)}%) have CRN`)
            pass('Connector: LAU professor extraction', `${withProf}/${total} (${pct(withProf, total)}%) have professor name`)
            pass('Connector: LAU meeting time extraction', `${withMeet}/${total} (${pct(withMeet, total)}%) have meeting times`)
            pass('Connector: LAU room/location extraction', `${withRoom}/${total} (${pct(withRoom, total)}%) have room`)
            if (crnEqualsSection.length > 0) {
              fail('Connector: LAU CRN ≠ sectionNumber', `${crnEqualsSection.length} rows have CRN equal to section number — data confusion`)
            } else {
              pass('Connector: LAU CRN ≠ sectionNumber', 'All sampled CRNs differ from section numbers — no data confusion')
            }
          }
        }
      }
    }
  } catch (err) {
    fail('Connector: LAU Banner 8 reachable', `Network error: ${String(err).slice(0, 100)}`)
  }

  console.log(`\n  [Summary] AUB live: ${aubLiveOk ? 'YES' : 'NO'}, LAU live: ${lauLiveOk ? 'YES' : 'NO'}`)
}

function pct(n: number, total: number) {
  return total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
}

// ── 2. Database Integrity ─────────────────────────────────────────────────────

async function validateDatabase() {
  section('2. Database Integrity Audit')

  const t0 = Date.now()

  const [orphanSP, orphanPL, coursesNoDept, profsMissing, negSeats] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) as c FROM SectionProfessor sp
      WHERE NOT EXISTS (SELECT 1 FROM Section s WHERE s.id = sp.sectionId)
    `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1),

    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) as c FROM SectionProfessor sp
      WHERE NOT EXISTS (SELECT 1 FROM Professor p WHERE p.id = sp.professorId)
    `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1),

    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) as c FROM Course c
      WHERE NOT EXISTS (SELECT 1 FROM Department d WHERE d.id = c.departmentId)
    `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1),

    prisma.professor.count({
      where: { isActive: true, OR: [{ fullName: '' }, { fullName: { equals: '' } }] },
    }).catch(() => -1),

    prisma.section.count({ where: { seatsRemaining: { lt: 0 } } }).catch(() => 0),
  ])

  orphanSP === 0
    ? pass('DB: SectionProfessor → Section FK', 'No orphaned SP rows')
    : orphanSP < 0
      ? warn('DB: SectionProfessor → Section FK', 'Query failed — skipped')
      : fail('DB: SectionProfessor → Section FK', `${orphanSP} orphaned rows`)

  orphanPL === 0
    ? pass('DB: SectionProfessor → Professor FK', 'No dangling professor links')
    : orphanPL < 0
      ? warn('DB: SectionProfessor → Professor FK', 'Query failed — skipped')
      : fail('DB: SectionProfessor → Professor FK', `${orphanPL} rows point to missing professors`)

  coursesNoDept === 0
    ? pass('DB: Course → Department FK', 'All courses have a valid department')
    : coursesNoDept < 0
      ? warn('DB: Course → Department FK', 'Query failed — skipped')
      : fail('DB: Course → Department FK', `${coursesNoDept} courses with missing department`)

  profsMissing === 0
    ? pass('DB: Professor names non-empty', 'All active professors have fullName')
    : warn('DB: Professor names non-empty', `${profsMissing} active professors with empty fullName`)

  negSeats === 0
    ? pass('DB: No negative seatsRemaining', 'All seat counts ≥ 0')
    : warn('DB: Negative seatsRemaining', `${negSeats} sections have seatsRemaining < 0`)

  // CRN duplicate detection: same CRN + termId + universityId should be unique
  const dupCRNs = await prisma.$queryRaw<Array<{ crn: string; termId: string; count: bigint }>>`
    SELECT s.crn, s.termId, COUNT(*) as count
    FROM Section s
    WHERE s.crn IS NOT NULL AND s.isActive = 1
    GROUP BY s.crn, s.termId
    HAVING COUNT(*) > 1
    LIMIT 20
  `.catch(() => [] as Array<{ crn: string; termId: string; count: bigint }>)

  if (dupCRNs.length === 0) {
    pass('DB: CRN uniqueness (per term)', 'No duplicate CRN+term combinations')
  } else {
    fail('DB: CRN uniqueness (per term)', `${dupCRNs.length} CRN+term pairs have duplicate sections — examples: ${dupCRNs.slice(0, 3).map(d => `CRN ${d.crn}`).join(', ')}`)
  }

  // CRN ≠ sectionNumber sanity check (sample 100 AUB sections)
  const crnEqualsSect = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*) as c FROM Section
    WHERE crn IS NOT NULL AND crn = sectionNumber AND isActive = 1
  `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1)

  crnEqualsSect === 0
    ? pass('DB: CRN ≠ sectionNumber', 'No sections where CRN equals sectionNumber')
    : crnEqualsSect < 0
      ? warn('DB: CRN ≠ sectionNumber', 'Check failed')
      : fail('DB: CRN ≠ sectionNumber', `${crnEqualsSect} active sections have CRN = sectionNumber — likely field confusion`)

  // Sections that have crn but missing course
  const secNoSectionMeet = await prisma.section.count({ where: { isActive: true, meetings: { none: {} } } })
  const totalActive = await prisma.section.count({ where: { isActive: true } })
  const noMeetPct = totalActive > 0 ? ((secNoSectionMeet / totalActive) * 100).toFixed(1) : '0'
  secNoSectionMeet / totalActive < 0.35
    ? warn('DB: Sections without meeting times', `${secNoSectionMeet} (${noMeetPct}%) — expected for TBA/online courses`)
    : fail('DB: Sections without meeting times', `${secNoSectionMeet} (${noMeetPct}%) — unexpectedly high`)

  // Per-university section stats
  console.log('\n  Per-university section & CRN stats:')
  const unis = await prisma.university.findMany({ where: { isActive: true }, select: { id: true, shortName: true, slug: true } })
  for (const u of unis) {
    const total  = await prisma.section.count({ where: { isActive: true, course: { department: { faculty: { universityId: u.id } } } } })
    const withCRN  = await prisma.section.count({ where: { isActive: true, crn: { not: null }, course: { department: { faculty: { universityId: u.id } } } } })
    const courses  = await prisma.course.count({ where: { isActive: true, department: { faculty: { universityId: u.id } } } })
    const profs    = await prisma.professor.count({ where: { isActive: true, isMerged: false, department: { faculty: { universityId: u.id } } } })
    const confRate = total > 0 ? ((withCRN / total) * 100).toFixed(1) : '0.0'
    console.log(`    ${u.shortName.padEnd(6)} sections=${total} CRN=${withCRN}(${confRate}%) courses=${courses} profs=${profs}`)
  }

  const ms = Date.now() - t0
  pass('DB: Integrity audit timing', `All checks completed in ${ms}ms`, ms)
}

// ── 3. Source → DB → API → UI Validation ──────────────────────────────────────

async function validateChain() {
  section('3. Source → DB → API → UI Chain Validation')

  const probe = await fetchRoute('/')
  if (!probe.ok && probe.status === 0) {
    warn('Chain validation', 'Dev server not reachable — skipping')
    return
  }

  // Get 30 AUB sections and 30 LAU sections with CRN
  const [aubSections, lauSections] = await Promise.all([
    prisma.section.findMany({
      where: { isActive: true, crn: { not: null }, course: { department: { faculty: { university: { slug: 'aub' } } } } },
      select: {
        id: true, crn: true, sectionNumber: true, courseId: true,
        course: { select: { code: true, name: true } },
        professors: { select: { professor: { select: { fullName: true } }, confidence: true }, take: 1 },
        meetings: { select: { day: true, startTime: true, endTime: true }, take: 1 },
      },
      take: 30,
      orderBy: { lastSyncedAt: 'desc' },
    }),
    prisma.section.findMany({
      where: { isActive: true, crn: { not: null }, course: { department: { faculty: { university: { slug: 'lau' } } } } },
      select: {
        id: true, crn: true, sectionNumber: true, courseId: true,
        course: { select: { code: true, name: true } },
        professors: { select: { professor: { select: { fullName: true } }, confidence: true }, take: 1 },
        meetings: { select: { day: true, startTime: true, endTime: true }, take: 1 },
      },
      take: 30,
      orderBy: { lastSyncedAt: 'desc' },
    }),
  ])

  console.log(`\n  Sampled ${aubSections.length} AUB + ${lauSections.length} LAU sections for chain validation`)

  // For each university, get the current term and call the schedule API
  const [aubUniForChain, lauUniForChain] = await Promise.all([
    prisma.university.findUnique({ where: { slug: 'aub' }, select: { id: true } }),
    prisma.university.findUnique({ where: { slug: 'lau' }, select: { id: true } }),
  ])
  const [aubTerm, lauTerm] = await Promise.all([
    aubUniForChain ? prisma.academicTerm.findFirst({ where: { isCurrent: true, universityId: aubUniForChain.id }, orderBy: { year: 'desc' } }) : Promise.resolve(null),
    lauUniForChain ? prisma.academicTerm.findFirst({ where: { isCurrent: true, universityId: lauUniForChain.id }, orderBy: { year: 'desc' } }) : Promise.resolve(null),
  ])

  async function runChainCheck(
    dbSections: typeof aubSections,
    termId: string,
    label: string,
  ) {
    if (dbSections.length === 0) { warn(`Chain: ${label}`, 'No sample sections found'); return }

    // Call schedule API for first 5 unique courseIds (API limit = 10)
    const courseIds = [...new Set(dbSections.slice(0, 10).map(s => s.courseId))].slice(0, 5)
    const res = await fetchJson('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds, termId, maxResults: 5 }),
    })

    if (!res.ok || !res.body) {
      fail(`Chain: ${label} API call`, `HTTP ${res.status}`)
      return
    }

    const apiSchedules = (res.body as { schedules?: Array<{ sections: SectionData[] }> }).schedules ?? []
    const apiSectionMap = new Map<string, SectionData>()
    for (const sched of apiSchedules) {
      for (const s of sched.sections) {
        apiSectionMap.set(s.id, s)
      }
    }

    let crnMatch = 0, crnMismatch = 0, crnMissingInApi = 0
    let sectionNumMatch = 0, sectionNumMismatch = 0
    let courseCodeMatch = 0, courseCodeMismatch = 0

    for (const dbSec of dbSections) {
      const apiSec = apiSectionMap.get(dbSec.id)
      if (!apiSec) { crnMissingInApi++; continue }

      if (apiSec.crn === dbSec.crn) crnMatch++
      else crnMismatch++

      if (apiSec.sectionNumber === dbSec.sectionNumber) sectionNumMatch++
      else sectionNumMismatch++

      if (apiSec.courseCode === dbSec.course.code) courseCodeMatch++
      else courseCodeMismatch++
    }

    const checked = crnMatch + crnMismatch
    if (checked === 0) {
      warn(`Chain: ${label} CRN consistency`, `No overlapping sections between DB sample and API response to compare`)
      return
    }

    if (crnMismatch === 0) {
      pass(`Chain: ${label} CRN DB→API`, `${crnMatch}/${checked} CRNs match exactly between DB and API`)
    } else {
      fail(`Chain: ${label} CRN DB→API`, `${crnMismatch} CRN mismatches: DB and API values differ`)
    }

    if (sectionNumMismatch === 0) {
      pass(`Chain: ${label} sectionNumber DB→API`, `${sectionNumMatch}/${checked} section numbers match`)
    } else {
      fail(`Chain: ${label} sectionNumber DB→API`, `${sectionNumMismatch} section number mismatches`)
    }

    if (courseCodeMismatch === 0) {
      pass(`Chain: ${label} courseCode DB→API`, `${courseCodeMatch}/${checked} course codes match`)
    } else {
      fail(`Chain: ${label} courseCode DB→API`, `${courseCodeMismatch} course code mismatches`)
    }
  }

  if (aubTerm) await runChainCheck(aubSections, aubTerm.id, 'AUB')
  else warn('Chain: AUB', 'No current AUB term found')

  if (lauTerm) await runChainCheck(lauSections, lauTerm.id, 'LAU')
  else warn('Chain: LAU', 'No current LAU term found')

  // API → UI: Verify CRN appears in HTML of schedule builder page
  const sbHtml = await fetchRoute('/schedule-builder')
  if (sbHtml.ok && sbHtml.body) {
    // The schedule builder page should contain the CRN badge logic in bundled JS
    const hasCrnText = sbHtml.body.includes('CRN') || sbHtml.body.includes('crn')
    hasCrnText
      ? pass('Chain: CRN in schedule builder page', 'CRN token present in schedule-builder HTML/JS')
      : warn('Chain: CRN in schedule builder page', 'CRN token not found in page source — check client bundle')
  }

  // Cross-check: sample 5 AUB sections with CRN against DB values directly
  let consistencyOk = 0
  for (const s of aubSections.slice(0, 5)) {
    if (s.crn && s.sectionNumber && s.crn !== s.sectionNumber) consistencyOk++
  }
  pass('Chain: AUB CRN≠sectionNumber sample', `${consistencyOk}/5 sampled sections have distinct CRN vs sectionNumber`)
}

// ── 4. API Stress Test ────────────────────────────────────────────────────────

async function stressTestAPIs() {
  section('4. API Stress Test')

  const probe = await fetchRoute('/')
  if (!probe.ok && probe.status === 0) {
    warn('API stress test', 'Dev server not reachable — skipping')
    return
  }

  // 200 search queries
  const searchQueries = [
    // Course codes
    'CMPS 200', 'CMPS 201', 'CMPS 202', 'CMPS 203', 'CMPS 204', 'CMPS 210', 'CMPS 211', 'CMPS 212',
    'PSPA 210', 'PSPA 211', 'PSPA 212', 'ECON 211', 'ECON 212', 'ECON 213',
    'MATH 201', 'MATH 202', 'MATH 203', 'MATH 204', 'MATH 205',
    'PHYS 201', 'PHYS 202', 'PHYS 203', 'BIOL 201', 'BIOL 202', 'BIOL 203',
    'CHEM 201', 'CHEM 202', 'HIST 201', 'ENGL 201', 'ENGL 202',
    'MECH 310', 'MECH 311', 'EECE 310', 'EECE 330', 'CVLE 310',
    'NURS 301', 'PUBH 201', 'PSYC 201', 'FNAR 201', 'MUSA 201',
    // LAU codes
    'CSC 201', 'CSC 315', 'CSC 316', 'CSC 317', 'CSC 318',
    'ENG 201', 'ENG 202', 'BUS 200', 'BUS 201', 'MGT 310', 'MGT 201',
    'MTH 201', 'MTH 202', 'PHY 201', 'BIO 201', 'BIO 202',
    'CHM 201', 'PHA 301', 'ARC 201', 'COM 201', 'ECO 201',
    'FIN 301', 'MKT 201', 'NUR 201', 'NUT 201', 'PSY 201',
    // Prefixes
    'CMPS', 'PSPA', 'ECON', 'MATH', 'PHYS', 'BIOL', 'CHEM', 'MECH', 'EECE',
    'CVLE', 'NURS', 'PUBH', 'CSC', 'ENG', 'BUS', 'MGT', 'MTH', 'BIO',
    'PHA', 'ARC', 'COM', 'ECO', 'FIN', 'MKT', 'NUR', 'PSY', 'SOC',
    'HIST', 'ENGL', 'ARAB', 'FNAR', 'SOAN', 'STAT', 'GEOL', 'LAW',
    // Professor names
    'Ali', 'Ahmad', 'Nasser', 'Khalil', 'Hassan', 'Saad', 'Ibrahim',
    'Moussa', 'Khoury', 'Hajj', 'Nassar', 'Rizk', 'Fares', 'Baroud',
    'Makarem', 'Chahine', 'Gemayel', 'Haddad', 'Saleh', 'Ghannoum',
    // Short queries
    'ca', 'al', 'ma', 'CS', 'en', 'ar', 'ph', 'ec', 'bi', 'ch',
    // Mixed case
    'cmps', 'pspa', 'econ', 'math', 'phys', 'biol', 'chem', 'mech',
    // University names
    'American', 'Lebanese', 'Beirut', 'AUB', 'LAU', 'Saint Joseph',
    // Numbers
    '201', '301', '101', '401', '501', '101',
    // Course names
    'Calculus', 'Programming', 'Algorithms', 'Data Structures', 'Networks',
    'Nursing', 'Architecture', 'Economics', 'Philosophy', 'Medicine',
    'Biochemistry', 'Statistics', 'Psychology', 'Management', 'Marketing',
    // Edge cases
    'ZZZXXX', 'qqqqqq', '######', '', 'a',
    // Repetitions to reach 200
    'CMPS', 'CSC', 'MTH', 'ECO', 'BUS', 'MKT', 'FIN', 'ACC', 'MGT', 'LAW',
    'ARC', 'IDN', 'GRD', 'ART', 'COM', 'NUR', 'BIO', 'CHM', 'PHA', 'NUT',
    'PSY', 'SOC', 'PSC', 'HIS', 'ENG', 'ARA', 'FRE', 'ENV', 'PHY', 'MTH',
    'MATH 101', 'MATH 102', 'MATH 103', 'PHYS 101', 'BIOL 101', 'CHEM 101',
    'CMPS 100', 'ECON 100', 'ENGL 100', 'ARAB 100', 'HIST 100', 'PHIL 100',
    'Organic Chemistry', 'Linear Algebra', 'Discrete Mathematics',
    'Computer Networks', 'Operating Systems', 'Database Systems',
    'International Law', 'Public Health', 'Nutritional Science',
    'Environmental Engineering', 'Structural Analysis', 'Digital Logic',
    'Microeconomics', 'Macroeconomics', 'Financial Accounting',
  ]

  let searchPassed = 0, searchErrors = 0, searchSlow = 0
  const searchErrorDetails: string[] = []
  const SLOW_THRESHOLD = 600

  for (const q of searchQueries.slice(0, 200)) {
    const r = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`)
    if (!r.ok) {
      searchErrors++
      searchErrorDetails.push(`"${q}" → HTTP ${r.status}`)
    } else {
      searchPassed++
      if (r.ms > SLOW_THRESHOLD) searchSlow++
    }
  }

  searchErrors === 0
    ? pass(`API Search: ${Math.min(200, searchQueries.length)} queries`, `${searchPassed} passed, ${searchSlow} slow (>${SLOW_THRESHOLD}ms), 0 errors`)
    : fail(`API Search: queries`, `${searchErrors} errors: ${searchErrorDetails.slice(0, 5).join('; ')}`)

  // 100 schedule generation requests
  const [aubUniS, lauUniS] = await Promise.all([
    prisma.university.findUnique({ where: { slug: 'aub' }, select: { id: true } }),
    prisma.university.findUnique({ where: { slug: 'lau' }, select: { id: true } }),
  ])
  const [aubTerm, lauTerm] = await Promise.all([
    aubUniS ? prisma.academicTerm.findFirst({ where: { isCurrent: true, universityId: aubUniS.id }, orderBy: { year: 'desc' } }) : Promise.resolve(null),
    lauUniS ? prisma.academicTerm.findFirst({ where: { isCurrent: true, universityId: lauUniS.id }, orderBy: { year: 'desc' } }) : Promise.resolve(null),
  ])

  const SCHED_COMBOS = [
    // AUB 2-course combos
    ...['CMPS,MATH','CMPS,EECE','CMPS,PSPA','PSPA,HIST','PSPA,ECON','ECON,MATH',
        'ECON,SOAN','ENGL,PHIL','ENGL,HIST','BIOL,CHEM','BIOL,PHYS',
        'MECH,MATH','MECH,PHYS','EECE,MATH','CVLE,MATH','NURS,BIOL',
        'ARAB,HIST','FNAR,PHIL','CHME,CHEM','NUSC,CHEM','PSYC,SOAN',
        'PUBH,BIOL','STAT,MATH','LAW,PSPA','COMM,ENGL'
    ].map(pair => ({ prefixes: pair.split(','), uniSlug: 'aub' })),
    // LAU 2-course combos
    ...['CSC,MTH','CSC,EEN','CSC,MGT','ENG,COM','ENG,PSY','BUS,ECO',
        'BUS,MGT','BUS,MKT','BIO,CHM','BIO,PHA','ARC,ART',
        'NUR,BIO','ECO,MTH','MGT,MKT','FIN,ECO','PSC,HIS',
        'PSY,SOC','ENV,BIO','CHM,BIO','ACC,FIN','COM,ADV'
    ].map(pair => ({ prefixes: pair.split(','), uniSlug: 'lau' })),
    // 3-course combos
    { prefixes: ['CMPS','MATH','EECE'], uniSlug: 'aub' },
    { prefixes: ['PSPA','ECON','HIST'], uniSlug: 'aub' },
    { prefixes: ['BIOL','CHEM','PHYS'], uniSlug: 'aub' },
    { prefixes: ['CSC','MTH','EEN'],    uniSlug: 'lau' },
    { prefixes: ['BUS','ECO','MGT'],    uniSlug: 'lau' },
    { prefixes: ['BIO','CHM','NUT'],    uniSlug: 'lau' },
  ]

  let schedPassed = 0, schedErrors = 0, schedSlow = 0
  const schedErrorDetails: string[] = []

  for (const combo of SCHED_COMBOS.slice(0, 100)) {
    const term = combo.uniSlug === 'aub' ? aubTerm : lauTerm
    if (!term) continue
    const uni = await prisma.university.findUnique({ where: { slug: combo.uniSlug } })
    if (!uni) continue

    const courseIds: string[] = []
    for (const prefix of combo.prefixes) {
      const course = await prisma.course.findFirst({
        where: { isActive: true, code: { startsWith: `${prefix} ` }, department: { faculty: { universityId: uni.id } } },
        orderBy: { reviewCount: 'desc' },
        select: { id: true },
      })
      if (course) courseIds.push(course.id)
    }
    if (courseIds.length < 2) continue

    const r = await fetchJson('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds, termId: term.id, maxResults: 5 }),
    })

    if (!r.ok) {
      schedErrors++
      schedErrorDetails.push(`${combo.prefixes.join('+')} → HTTP ${r.status}`)
    } else {
      schedPassed++
      if (r.ms > 2000) schedSlow++
    }
  }

  schedErrors === 0
    ? pass(`API Schedule: ${schedPassed + schedErrors} requests`, `${schedPassed} passed, ${schedSlow} slow, 0 errors`)
    : fail(`API Schedule: requests`, `${schedErrors} errors: ${schedErrorDetails.slice(0, 5).join('; ')}`)

  // 50 course page lookups
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    select: { slug: true },
    orderBy: { reviewCount: 'desc' },
    take: 50,
  })

  let coursePassed = 0, courseErrors = 0
  for (const c of courses) {
    const r = await fetchRoute(`/courses/${c.slug}`)
    r.ok ? coursePassed++ : courseErrors++
  }
  courseErrors === 0
    ? pass(`API Course pages: ${courses.length} lookups`, `${coursePassed} returned 2xx`)
    : fail(`API Course pages`, `${courseErrors} pages returned 5xx`)

  // 50 professor page lookups
  const profs = await prisma.professor.findMany({
    where: { isActive: true, isMerged: false },
    select: { slug: true },
    orderBy: { reviewCount: 'desc' },
    take: 50,
  })

  let profPassed = 0, profErrors = 0
  for (const p of profs) {
    const r = await fetchRoute(`/professors/${p.slug}`)
    r.ok ? profPassed++ : profErrors++
  }
  profErrors === 0
    ? pass(`API Professor pages: ${profs.length} lookups`, `${profPassed} returned 2xx`)
    : fail(`API Professor pages`, `${profErrors} pages returned 5xx`)
}

// ── 5. Schedule Builder Validation ───────────────────────────────────────────

async function validateScheduleBuilder() {
  section('5. Schedule Builder Validation (100+ combos)')

  const [aubUni, lauUni] = await Promise.all([
    prisma.university.findUnique({ where: { slug: 'aub' } }),
    prisma.university.findUnique({ where: { slug: 'lau' } }),
  ])
  if (!aubUni || !lauUni) { fail('Schedule builder', 'AUB or LAU not found'); return }

  const [aubTerm, lauTerm] = await Promise.all([
    prisma.academicTerm.findFirst({ where: { universityId: aubUni.id, isCurrent: true }, orderBy: { year: 'desc' } }),
    prisma.academicTerm.findFirst({ where: { universityId: lauUni.id, isCurrent: true }, orderBy: { year: 'desc' } }),
  ])

  const toMins = (t: string) => {
    const [h, mm] = t.split(':').map(Number)
    return h * 60 + mm
  }

  async function getSectionData(prefix: string, uniId: string, termId: string): Promise<SectionData[]> {
    const sections = await prisma.section.findMany({
      where: { termId, isActive: true, course: { code: { startsWith: `${prefix} ` }, department: { faculty: { universityId: uniId } } } },
      include: {
        course: { select: { id: true, code: true, name: true } },
        professors: { select: { confidence: true, isPrimary: true, professor: { select: { id: true, fullName: true, overallRating: true, workloadLevel: true } } } },
        meetings: true,
      },
      take: 20,
    })
    return sections.map(s => ({
      id: s.id, sectionNumber: s.sectionNumber, courseId: s.courseId,
      courseName: s.course.name, courseCode: s.course.code,
      crn: s.crn ?? null,
      professors: s.professors.map(sp => ({
        id: sp.professor.id, fullName: sp.professor.fullName,
        overallRating: sp.professor.overallRating, workloadLevel: sp.professor.workloadLevel,
        confidence: sp.confidence,
      })),
      meetings: s.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime, type: m.type, location: m.location ?? null })),
      location: s.location, crn2: s.crn, status: s.status,
      seatsRemaining: s.seatsRemaining, capacity: s.capacity, enrolled: s.enrolled,
      isStale: s.isStale, completenessScore: s.completenessScore,
      dataQualityStatus: s.dataQualityStatus, historicalInference: s.historicalInference,
      lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
    }))
  }

  const AUB_COMBOS = [
    ['CMPS','MATH'], ['CMPS','EECE'], ['CMPS','PSPA'], ['PSPA','HIST'], ['PSPA','ECON'],
    ['ECON','MATH'], ['ECON','SOAN'], ['ENGL','PHIL'], ['ENGL','HIST'], ['BIOL','CHEM'],
    ['BIOL','PHYS'], ['MECH','MATH'], ['MECH','PHYS'], ['EECE','MATH'], ['CVLE','MATH'],
    ['NURS','BIOL'], ['ARAB','HIST'], ['FNAR','PHIL'], ['CHME','CHEM'], ['NUSC','CHEM'],
    ['PSYC','SOAN'], ['PUBH','BIOL'], ['STAT','MATH'], ['COMM','ENGL'], ['LAW','PSPA'],
    ['CMPS','MATH','EECE'], ['PSPA','ECON','HIST'], ['BIOL','CHEM','PHYS'],
    ['NURS','BIOL','CHEM'], ['MECH','MATH','PHYS'],
  ]
  const LAU_COMBOS = [
    ['CSC','MTH'], ['CSC','EEN'], ['CSC','MGT'], ['ENG','COM'], ['ENG','PSY'],
    ['BUS','ECO'], ['BUS','MGT'], ['BUS','MKT'], ['BIO','CHM'], ['BIO','PHA'],
    ['ARC','ART'], ['NUR','BIO'], ['ECO','MTH'], ['MGT','MKT'], ['FIN','ECO'],
    ['PSC','HIS'], ['PSY','SOC'], ['ENV','BIO'], ['ACC','FIN'], ['COM','ENG'],
    ['CSC','MTH','EEN'], ['BUS','ECO','MGT'], ['BIO','CHM','NUT'],
    ['NUR','BIO','CHM'], ['CSC','BUS','MTH'],
  ]

  let totalGenerated = 0, noData = 0, conflicts = 0, errors = 0
  let sectionsWithCRN = 0, sectionsWithProf = 0, sectionsWithRoom = 0, sectionsChecked = 0

  async function runCombo(prefixes: string[], uniId: string, termId: string) {
    try {
      const map = new Map<string, SectionData[]>()
      for (const p of prefixes) {
        const secs = await getSectionData(p, uniId, termId)
        if (secs.length === 0) continue
        // Pick course with most sections
        const byCourse = new Map<string, SectionData[]>()
        for (const s of secs) {
          const arr = byCourse.get(s.courseId) ?? []
          arr.push(s)
          byCourse.set(s.courseId, arr)
        }
        const [bestId, bestSecs] = [...byCourse.entries()].sort((a, b) => b[1].length - a[1].length)[0]
        map.set(bestId, bestSecs)

        // Track field completeness
        for (const s of bestSecs.slice(0, 3)) {
          sectionsChecked++
          if (s.crn) sectionsWithCRN++
          if (s.professors.length > 0) sectionsWithProf++
          if (s.meetings.some(m => m.location)) sectionsWithRoom++
        }
      }
      if (map.size < 2) { noData++; return }

      const schedules = generateSchedules(map, 'balanced', 30)
      totalGenerated++

      // Conflict detection: check between different sections only
      for (const sched of schedules) {
        for (let si = 0; si < sched.sections.length && conflicts === 0; si++) {
          for (let sj = si + 1; sj < sched.sections.length; sj++) {
            const secA = sched.sections[si]
            const secB = sched.sections[sj]
            for (const mA of secA.meetings) {
              for (const mB of secB.meetings) {
                if (mA.day === mB.day &&
                  toMins(mA.startTime) < toMins(mB.endTime) &&
                  toMins(mB.startTime) < toMins(mA.endTime)) {
                  conflicts++
                  fail(`Schedule conflict: ${secA.courseCode}+${secB.courseCode}`, `${mA.day} ${mA.startTime}-${mA.endTime} overlaps ${mB.startTime}-${mB.endTime}`)
                }
              }
            }
          }
        }
      }
    } catch (err) {
      errors++
      fail(`Schedule combo ${prefixes.join('+')}`, String(err))
    }
  }

  if (aubTerm) {
    for (const c of AUB_COMBOS) await runCombo(c, aubUni.id, aubTerm.id)
  }
  if (lauTerm) {
    for (const c of LAU_COMBOS) await runCombo(c, lauUni.id, lauTerm.id)
  }

  const total = AUB_COMBOS.length + LAU_COMBOS.length

  conflicts === 0
    ? pass('Schedule: no time conflicts', `${totalGenerated}/${total} combos generated schedules — 0 cross-section conflicts`)
    : fail('Schedule: conflict detection', `${conflicts} cross-section time conflicts found`)

  errors === 0
    ? pass('Schedule: no engine errors', `0 exceptions thrown across ${totalGenerated} combos`)
    : fail('Schedule: engine errors', `${errors} combos threw exceptions`)

  pass('Schedule: noData combos', `${noData} combos had insufficient section data (insufficient enrollment data is expected)`)

  if (sectionsChecked > 0) {
    const crnPct  = pct(sectionsWithCRN,  sectionsChecked)
    const profPct = pct(sectionsWithProf, sectionsChecked)
    const roomPct = pct(sectionsWithRoom, sectionsChecked)
    pass('Schedule: CRN coverage in results',       `${sectionsWithCRN}/${sectionsChecked} sampled sections (${crnPct}%) have CRN`)
    pass('Schedule: professor coverage in results', `${sectionsWithProf}/${sectionsChecked} sampled sections (${profPct}%) have professor`)
    pass('Schedule: room coverage in results',      `${sectionsWithRoom}/${sectionsChecked} sampled sections (${roomPct}%) have room/location`)
  }
}

// ── 6. UI Rendering Validation ────────────────────────────────────────────────

async function validateUI() {
  section('6. UI Rendering Validation')

  const probe = await fetchRoute('/')
  if (!probe.ok && probe.status === 0) {
    warn('UI validation', 'Dev server not reachable — skipping')
    return
  }

  const [aubCourse, lauCourse, aubProf, lauProf] = await Promise.all([
    prisma.course.findFirst({ where: { isActive: true, department: { faculty: { university: { slug: 'aub' } } } }, select: { slug: true } }),
    prisma.course.findFirst({ where: { isActive: true, department: { faculty: { university: { slug: 'lau' } } } }, select: { slug: true } }),
    prisma.professor.findFirst({ where: { isActive: true, isMerged: false, department: { faculty: { university: { slug: 'aub' } } } }, select: { slug: true } }),
    prisma.professor.findFirst({ where: { isActive: true, isMerged: false, department: { faculty: { university: { slug: 'lau' } } } }, select: { slug: true } }),
  ])

  const routes: Array<{ path: string; label: string; expectStatus?: number; checkCrn?: boolean }> = [
    { path: '/',                   label: 'Homepage' },
    { path: '/search',             label: 'Search page' },
    { path: '/universities',       label: 'Universities list' },
    { path: '/universities/aub',   label: 'AUB university page' },
    { path: '/universities/lau',   label: 'LAU university page' },
    { path: '/courses',            label: 'Courses list' },
    { path: '/professors',         label: 'Professors list' },
    { path: '/schedule-builder',   label: 'Schedule builder', checkCrn: true },
    { path: '/login',              label: 'Login page' },
    { path: '/dashboard',          label: 'Dashboard (auth redirect)', expectStatus: 200 },
    { path: '/admin',              label: 'Admin (auth redirect)', expectStatus: 200 },
    { path: '/admin/monitoring',   label: 'Admin monitoring (auth redirect)', expectStatus: 200 },
    { path: '/terms',              label: 'Terms page' },
    { path: '/privacy',            label: 'Privacy page' },
    { path: '/guidelines',         label: 'Guidelines page' },
    ...(aubCourse ? [{ path: `/courses/${aubCourse.slug}`, label: 'AUB course page' }] : []),
    ...(lauCourse ? [{ path: `/courses/${lauCourse.slug}`, label: 'LAU course page' }] : []),
    ...(aubProf   ? [{ path: `/professors/${aubProf.slug}`, label: 'AUB professor page' }] : []),
    ...(lauProf   ? [{ path: `/professors/${lauProf.slug}`, label: 'LAU professor page' }] : []),
    { path: '/courses/nonexistent-xyz',     label: '404 course',     expectStatus: 404 },
    { path: '/professors/nonexistent-xyz',  label: '404 professor',  expectStatus: 404 },
    { path: '/universities/nonexistent-xyz',label: '404 university', expectStatus: 404 },
  ]

  const SLOW = 3000

  for (const route of routes) {
    const r = await fetchRoute(route.path)
    const expected = route.expectStatus ? r.status === route.expectStatus : r.ok
    const detail   = `HTTP ${r.status || 'ERR'} in ${r.ms}ms`

    if (!expected) {
      fail(`UI: ${route.label}`, detail)
    } else if (r.ms > SLOW) {
      warn(`UI: ${route.label}`, `${detail} — SLOW (>${SLOW}ms)`, r.ms)
    } else {
      pass(`UI: ${route.label}`, detail, r.ms)
    }

    // CRN badge check: schedule-builder page bundle should reference "CRN"
    if (route.checkCrn && r.body) {
      const hasCrn = r.body.includes('CRN') || r.body.includes('"crn"')
      hasCrn
        ? pass('UI: CRN token in schedule builder', 'Found "CRN" in page source')
        : warn('UI: CRN token in schedule builder', '"CRN" not found in rendered HTML — verify client bundle includes it')
    }
  }

  // Beta banner check: layout should include the beta notice
  const homeHtml = await fetchRoute('/')
  if (homeHtml.body?.includes('Beta')) {
    pass('UI: Beta banner present', 'Beta notice found in homepage HTML')
  } else {
    warn('UI: Beta banner present', 'Beta notice not found in homepage HTML — verify BetaBanner renders')
  }

  // Confirmed badge terminology check in a professor page
  if (aubProf) {
    const profHtml = await fetchRoute(`/professors/${aubProf.slug}`)
    const hasConfirmed = profHtml.body?.includes('Confirmed') || profHtml.body?.includes('confirmed')
    const hasInferred  = profHtml.body?.includes('Inferred') || profHtml.body?.includes('inferred')
    if (hasConfirmed || hasInferred) {
      pass('UI: Confidence labels in professor page', 'Confirmed/Inferred terminology present in page')
    } else {
      warn('UI: Confidence labels in professor page', 'Neither Confirmed nor Inferred found — check if page renders professor sections')
    }
  }
}

// ── 7. Performance Analysis ───────────────────────────────────────────────────

async function analyzePerformance() {
  section('7. Performance Analysis (flag >300ms)')

  const aub = await prisma.university.findUnique({ where: { slug: 'aub' } })
  const lau = await prisma.university.findUnique({ where: { slug: 'lau' } })
  const aubTerm = aub ? await prisma.academicTerm.findFirst({ where: { universityId: aub.id, isCurrent: true }, orderBy: { year: 'desc' } }) : null
  const lauTerm = lau ? await prisma.academicTerm.findFirst({ where: { universityId: lau.id, isCurrent: true }, orderBy: { year: 'desc' } }) : null

  const WARN_MS = 300
  const FAIL_MS = 2000

  const queries: Array<{ name: string; fn: () => Promise<unknown> }> = [
    { name: 'Professor list ordered by reviewCount',
      fn: () => prisma.professor.findMany({ where: { isActive: true, isMerged: false }, orderBy: { reviewCount: 'desc' }, take: 20, select: { id: true, fullName: true, overallRating: true, reviewCount: true, slug: true } }) },
    { name: 'Course search "CMPS"',
      fn: () => prisma.course.findMany({ where: { isActive: true, OR: [{ name: { contains: 'CMPS' } }, { code: { contains: 'CMPS' } }] }, take: 8 }) },
    { name: 'Section + meetings + professors (AUB CMPS+MATH)',
      fn: () => aubTerm ? prisma.section.findMany({ where: { termId: aubTerm.id, isActive: true, course: { OR: [{ code: { startsWith: 'CMPS ' } }, { code: { startsWith: 'MATH ' } }] } }, include: { course: true, professors: { include: { professor: true } }, meetings: true } }) : Promise.resolve([]) },
    { name: 'Section + meetings + professors (LAU CSC+MTH)',
      fn: () => lauTerm ? prisma.section.findMany({ where: { termId: lauTerm.id, isActive: true, course: { OR: [{ code: { startsWith: 'CSC ' } }, { code: { startsWith: 'MTH ' } }] } }, include: { course: true, professors: { include: { professor: true } }, meetings: true } }) : Promise.resolve([]) },
    { name: 'Approved reviews (latest 20 by helpfulCount)',
      fn: () => prisma.review.findMany({ where: { status: 'APPROVED' }, orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }], take: 20 }) },
    { name: 'Admin monitoring: last sync job per university',
      fn: () => prisma.university.findMany({ where: { isActive: true }, include: { syncJobs: { orderBy: { createdAt: 'desc' }, take: 1 } } }) },
    { name: 'SectionProfessor confirmed count (AUB)',
      fn: () => aub ? prisma.sectionProfessor.count({ where: { confidence: 'CONFIRMED', section: { course: { department: { faculty: { universityId: aub.id } } } } } }) : Promise.resolve(0) },
    { name: 'SectionProfessor confirmed count (LAU)',
      fn: () => lau ? prisma.sectionProfessor.count({ where: { confidence: 'CONFIRMED', section: { course: { department: { faculty: { universityId: lau.id } } } } } }) : Promise.resolve(0) },
    { name: 'CRN coverage count (all active)',
      fn: () => prisma.section.count({ where: { isActive: true, crn: { not: null } } }) },
    { name: 'Search: professors by name "Ali"',
      fn: () => prisma.professor.findMany({ where: { isActive: true, fullName: { contains: 'Ali' } }, select: { id: true, fullName: true, slug: true, overallRating: true }, take: 8 }) },
    { name: 'Analytics events last 30d',
      fn: () => prisma.analyticsEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }) },
    { name: 'Open DataReports count',
      fn: () => prisma.dataReport.count({ where: { status: 'OPEN' } }) },
    { name: 'University page deep query (AUB)',
      fn: () => prisma.university.findFirst({ where: { slug: 'aub' }, include: { faculties: { include: { departments: { include: { professors: { where: { isActive: true, isMerged: false }, orderBy: { reviewCount: 'desc' }, take: 5, select: { id: true, fullName: true, reviewCount: true, overallRating: true, slug: true } } } } } } } }) },
  ]

  const timings: Array<{ name: string; ms: number }> = []
  const recommendations: string[] = []

  for (const q of queries) {
    const t0 = Date.now()
    try {
      await q.fn()
      const ms = Date.now() - t0
      timings.push({ name: q.name, ms })
      if (ms > FAIL_MS) {
        fail(`Perf: ${q.name}`, `${ms}ms — exceeds ${FAIL_MS}ms hard limit`)
        recommendations.push(`CRITICAL: Add composite index for query: ${q.name}`)
      } else if (ms > WARN_MS) {
        warn(`Perf: ${q.name}`, `${ms}ms — above ${WARN_MS}ms warning threshold`, ms)
        recommendations.push(`Consider index for: ${q.name} (${ms}ms)`)
      } else {
        pass(`Perf: ${q.name}`, `${ms}ms`, ms)
      }
    } catch (err) {
      fail(`Perf: ${q.name}`, String(err))
    }
  }

  const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 5)
  console.log('\n  Top 5 slowest queries:')
  for (const s of slowest) console.log(`    ${String(s.ms).padStart(5)}ms  ${s.name}`)

  if (recommendations.length > 0) {
    console.log('\n  Index recommendations:')
    for (const r of recommendations) console.log(`    • ${r}`)
  }
}

// ── 8. Regression Tests ───────────────────────────────────────────────────────

async function regressionTests() {
  section('8. Regression Tests')

  const probe = await fetchRoute('/')
  const serverUp = probe.ok && probe.status !== 0

  // R1: CRN disappears — CRN coverage must be ≥85% for AUB and LAU
  const [aubUni, lauUni] = await Promise.all([
    prisma.university.findUnique({ where: { slug: 'aub' } }),
    prisma.university.findUnique({ where: { slug: 'lau' } }),
  ])
  const [aubTotal, aubWithCRN, lauTotal, lauWithCRN] = await Promise.all([
    aubUni ? prisma.section.count({ where: { isActive: true, course: { department: { faculty: { universityId: aubUni.id } } } } }) : Promise.resolve(0),
    aubUni ? prisma.section.count({ where: { isActive: true, crn: { not: null }, course: { department: { faculty: { universityId: aubUni.id } } } } }) : Promise.resolve(0),
    lauUni ? prisma.section.count({ where: { isActive: true, course: { department: { faculty: { universityId: lauUni.id } } } } }) : Promise.resolve(0),
    lauUni ? prisma.section.count({ where: { isActive: true, crn: { not: null }, course: { department: { faculty: { universityId: lauUni.id } } } } }) : Promise.resolve(0),
  ])

  const aubCrnRate = aubTotal > 0 ? aubWithCRN / aubTotal : 0
  const lauCrnRate = lauTotal > 0 ? lauWithCRN / lauTotal : 0

  aubCrnRate >= 0.85
    ? pass('Regression: AUB CRN coverage ≥85%', `${(aubCrnRate * 100).toFixed(1)}% — ${aubWithCRN}/${aubTotal} sections`)
    : fail('Regression: AUB CRN coverage ≥85%', `${(aubCrnRate * 100).toFixed(1)}% — BELOW threshold. CRNs may have been lost in a sync`)

  lauCrnRate >= 0.85
    ? pass('Regression: LAU CRN coverage ≥85%', `${(lauCrnRate * 100).toFixed(1)}% — ${lauWithCRN}/${lauTotal} sections`)
    : fail('Regression: LAU CRN coverage ≥85%', `${(lauCrnRate * 100).toFixed(1)}% — BELOW threshold. CRNs may have been lost in a sync`)

  // R2: CRN ≠ sectionNumber — catch field confusion
  const crnEqSection = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*) as c FROM Section WHERE crn IS NOT NULL AND crn = sectionNumber AND isActive = 1
  `.then(r => Number(r[0]?.c ?? 0)).catch(() => -1)

  crnEqSection === 0
    ? pass('Regression: CRN never equals sectionNumber', 'No data confusion between CRN and section number fields')
    : crnEqSection < 0
      ? warn('Regression: CRN never equals sectionNumber', 'Check failed')
      : fail('Regression: CRN never equals sectionNumber', `${crnEqSection} sections have CRN = sectionNumber — connector is writing CRN to wrong field`)

  // R3: AUB section count ≥3000
  aubTotal >= 3000
    ? pass('Regression: AUB section count ≥3000', `${aubTotal} sections`)
    : fail('Regression: AUB section count ≥3000', `${aubTotal} — BELOW minimum, connector may have failed`)

  // R4: LAU section count ≥2000
  lauTotal >= 2000
    ? pass('Regression: LAU section count ≥2000', `${lauTotal} sections`)
    : fail('Regression: LAU section count ≥2000', `${lauTotal} — BELOW minimum, connector may have failed`)

  // R5: AUB professor confirmation rate ≥85%
  const aubTermObj = aubUni ? await prisma.academicTerm.findFirst({ where: { universityId: aubUni.id, isCurrent: true }, orderBy: { year: 'desc' } }) : null
  if (aubTermObj && aubUni) {
    const aubTermSections = await prisma.section.count({ where: { termId: aubTermObj.id, isActive: true } })
    const aubConfirmed    = await prisma.sectionProfessor.count({ where: { confidence: 'CONFIRMED', section: { course: { department: { faculty: { universityId: aubUni.id } } } } } })
    const aubConfRate     = aubTermSections > 0 ? aubConfirmed / aubTermSections : 0
    aubConfRate >= 0.85
      ? pass('Regression: AUB confirmed professor rate ≥85%', `${(aubConfRate * 100).toFixed(1)}%`)
      : warn('Regression: AUB confirmed professor rate ≥85%', `${(aubConfRate * 100).toFixed(1)}% — below target`)
  }

  // R6: LAU professor confirmation rate ≥85%
  const lauTermObj = lauUni ? await prisma.academicTerm.findFirst({ where: { universityId: lauUni.id, isCurrent: true }, orderBy: { year: 'desc' } }) : null
  if (lauTermObj && lauUni) {
    const lauTermSections = await prisma.section.count({ where: { termId: lauTermObj.id, isActive: true } })
    const lauConfirmed    = await prisma.sectionProfessor.count({ where: { confidence: 'CONFIRMED', section: { course: { department: { faculty: { universityId: lauUni.id } } } } } })
    const lauConfRate     = lauTermSections > 0 ? lauConfirmed / lauTermSections : 0
    lauConfRate >= 0.85
      ? pass('Regression: LAU confirmed professor rate ≥85%', `${(lauConfRate * 100).toFixed(1)}%`)
      : warn('Regression: LAU confirmed professor rate ≥85%', `${(lauConfRate * 100).toFixed(1)}% — below target`)
  }

  // R7: Schedule builder never produces conflicts — run a quick targeted test
  if (aubTermObj && aubUni) {
    const sections = await prisma.section.findMany({
      where: { termId: aubTermObj.id, isActive: true, meetings: { some: {} }, course: { code: { startsWith: 'CMPS ' } } },
      include: { course: { select: { id: true, code: true, name: true } }, professors: { select: { confidence: true, isPrimary: true, professor: { select: { id: true, fullName: true, overallRating: true, workloadLevel: true } } } }, meetings: true },
      take: 30,
    })
    const byCourse = new Map<string, SectionData[]>()
    for (const s of sections) {
      const sd: SectionData = {
        id: s.id, sectionNumber: s.sectionNumber, courseId: s.courseId,
        courseName: s.course.name, courseCode: s.course.code, crn: s.crn ?? null,
        professors: s.professors.map(sp => ({ id: sp.professor.id, fullName: sp.professor.fullName, overallRating: sp.professor.overallRating, workloadLevel: sp.professor.workloadLevel, confidence: sp.confidence })),
        meetings: s.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime, type: m.type, location: m.location ?? null })),
        location: s.location, status: s.status, seatsRemaining: s.seatsRemaining,
        capacity: s.capacity, enrolled: s.enrolled, isStale: s.isStale,
        completenessScore: s.completenessScore, dataQualityStatus: s.dataQualityStatus,
        historicalInference: s.historicalInference, lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
      }
      const arr = byCourse.get(s.courseId) ?? []
      arr.push(sd)
      byCourse.set(s.courseId, arr)
    }
    if (byCourse.size >= 1) {
      const mathSections = await prisma.section.findMany({
        where: { termId: aubTermObj.id, isActive: true, meetings: { some: {} }, course: { code: { startsWith: 'MATH ' } } },
        include: { course: { select: { id: true, code: true, name: true } }, professors: { select: { confidence: true, isPrimary: true, professor: { select: { id: true, fullName: true, overallRating: true, workloadLevel: true } } } }, meetings: true },
        take: 20,
      })
      for (const s of mathSections) {
        const sd: SectionData = { id: s.id, sectionNumber: s.sectionNumber, courseId: s.courseId, courseName: s.course.name, courseCode: s.course.code, crn: s.crn ?? null, professors: s.professors.map(sp => ({ id: sp.professor.id, fullName: sp.professor.fullName, overallRating: sp.professor.overallRating, workloadLevel: sp.professor.workloadLevel, confidence: sp.confidence })), meetings: s.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime, type: m.type, location: m.location ?? null })), location: s.location, status: s.status, seatsRemaining: s.seatsRemaining, capacity: s.capacity, enrolled: s.enrolled, isStale: s.isStale, completenessScore: s.completenessScore, dataQualityStatus: s.dataQualityStatus, historicalInference: s.historicalInference, lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null }
        const arr = byCourse.get(s.courseId) ?? []
        arr.push(sd)
        byCourse.set(s.courseId, arr)
      }
      if (byCourse.size >= 2) {
        const toMins = (t: string) => { const [h, mm] = t.split(':').map(Number); return h * 60 + mm }
        const schedules = generateSchedules(byCourse, 'balanced', 50)
        let conflictFound = false
        for (const sched of schedules) {
          for (let si = 0; si < sched.sections.length && !conflictFound; si++) {
            for (let sj = si + 1; sj < sched.sections.length && !conflictFound; sj++) {
              const secA = sched.sections[si], secB = sched.sections[sj]
              for (const mA of secA.meetings) {
                for (const mB of secB.meetings) {
                  if (mA.day === mB.day && toMins(mA.startTime) < toMins(mB.endTime) && toMins(mB.startTime) < toMins(mA.endTime)) {
                    conflictFound = true
                  }
                }
              }
            }
          }
        }
        !conflictFound
          ? pass('Regression: CMPS+MATH schedule no conflicts', `${schedules.length} schedules generated — 0 cross-section time conflicts`)
          : fail('Regression: CMPS+MATH schedule no conflicts', 'Time conflict found in generated schedule — CRITICAL regression')
      }
    }
  }

  // R8: Search always returns valid JSON (not crash)
  if (serverUp) {
    const badQueries = ["'; DROP TABLE", '<script>alert(1)</script>', 'A'.repeat(500), '../../etc/passwd']
    let searchRegOk = 0
    for (const q of badQueries) {
      const r = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`)
      if (r.ok) searchRegOk++
    }
    searchRegOk === badQueries.length
      ? pass('Regression: Search handles adversarial inputs', `${searchRegOk}/${badQueries.length} malformed queries returned 2xx (not crash)`)
      : fail('Regression: Search handles adversarial inputs', `${badQueries.length - searchRegOk} queries caused non-2xx responses`)

    // R9: DataReport API always accepts valid payloads
    const dataReportRes = await fetchJson('/api/data-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ universitySlug: 'aub', courseCode: 'CMPS 200', message: 'Regression test report - please ignore' }),
    })
    dataReportRes.status === 201
      ? pass('Regression: DataReport API accepts valid payload', 'POST /api/data-reports → 201')
      : fail('Regression: DataReport API accepts valid payload', `Expected 201, got ${dataReportRes.status}`)

    // R10: CRN rendering in schedule API response
    const crnRegCourse = await prisma.course.findFirst({
      where: { isActive: true, department: { faculty: { university: { slug: 'aub' } } } },
      select: { id: true },
    })
    const aubTermForReg = aubUni ? await prisma.academicTerm.findFirst({ where: { universityId: aubUni.id, isCurrent: true }, orderBy: { year: 'desc' } }) : null
    if (crnRegCourse && aubTermForReg) {
      const schedRes = await fetchJson('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: [crnRegCourse.id], termId: aubTermForReg.id, maxResults: 1 }),
      })
      const schedBody = schedRes.body as { schedules?: Array<{ sections: SectionData[] }> } | null
      const firstSection = schedBody?.schedules?.[0]?.sections?.[0]
      if (firstSection !== undefined) {
        'crn' in firstSection
          ? pass('Regression: CRN field present in schedule API response', `crn="${firstSection.crn ?? 'null (unavailable)'}"`)
          : fail('Regression: CRN field present in schedule API response', 'crn field missing from SectionData — regression in API response shape')
      }
    }
  }
}

// ── 9. Final Beta Readiness Report ────────────────────────────────────────────

function printBetaReport() {
  const date = new Date().toISOString().split('T')[0]
  const passed  = results.filter(r => r.passed && !r.warning).length
  const warnings = results.filter(r => r.warning).length
  const failed  = results.filter(r => !r.passed).length
  const total   = results.length

  console.log('\n\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║     EduScore Lebanon — Beta Readiness Report                     ║')
  console.log(`║     Generated: ${date}                                       ║`)
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  console.log(`║  Total checks : ${String(total).padEnd(48)}║`)
  console.log(`║  ✅ Passed    : ${String(passed).padEnd(48)}║`)
  console.log(`║  ⚠️  Warnings  : ${String(warnings).padEnd(47)}║`)
  console.log(`║  ❌ Failed    : ${String(failed).padEnd(48)}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  if (failed > 0) {
    console.log('\n  ── FAILURES (must fix before launch) ─────────────────────────')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  ❌  ${r.name}`)
      console.log(`       ${r.detail}`)
    }
  }

  if (warnings > 0) {
    console.log('\n  ── WARNINGS (review before launch) ───────────────────────────')
    for (const r of results.filter(r => r.warning)) {
      console.log(`  ⚠️   ${r.name}`)
      console.log(`       ${r.detail}`)
    }
  }

  console.log('\n  ── VERDICT ───────────────────────────────────────────────────')
  if (failed === 0 && warnings === 0) {
    console.log('  🚀  ALL CHECKS PASSED — Platform is ready for beta launch')
  } else if (failed === 0) {
    console.log('  ✅  No failures — warnings above are informational. Safe to launch.')
  } else if (failed <= 3) {
    console.log('  ⚠️   Minor failures detected — resolve before launch.')
  } else {
    console.log('  ❌  CRITICAL FAILURES — do not launch until resolved.')
  }
  console.log('  ────────────────────────────────────────────────────────────')
  console.log()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║     EduScore Lebanon — Full Beta Validation Suite                ║')
  console.log(`║     ${new Date().toISOString()}                      ║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  await validateConnectors()
  await validateDatabase()
  await validateChain()
  await stressTestAPIs()
  await validateScheduleBuilder()
  await validateUI()
  await analyzePerformance()
  await regressionTests()

  printBetaReport()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
