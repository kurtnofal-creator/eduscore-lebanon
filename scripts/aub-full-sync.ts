/**
 * AUB Full Sync – adds missing departments and runs a complete AUB catalog ingestion.
 *
 * Run:
 *   export PATH="/Users/kurtnofal/node-v22.14.0-darwin-arm64/bin:$PATH"
 *   npx tsx scripts/aub-full-sync.ts
 */

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

// ── AUB missing faculties and departments ─────────────────────────────────────

const MISSING_FACULTIES: Array<{
  name: string
  slug: string
  departments: Array<{ name: string; code: string; slug: string }>
}> = [
  {
    name: 'Faculty of Arts & Sciences – Humanities & Social Sciences',
    slug: 'fas-hss',
    departments: [
      { name: 'Arabic & Near Eastern Languages', code: 'ARAB', slug: 'arab' },
      { name: 'English', code: 'ENGL', slug: 'engl' },
      { name: 'History & Archaeology', code: 'HIST', slug: 'hist' },
      { name: 'Philosophy', code: 'PHIL', slug: 'phil' },
      { name: 'Political Studies & Public Administration', code: 'PSPA', slug: 'pspa' },
      { name: 'Sociology, Anthropology & Media Studies', code: 'SOAN', slug: 'soan' },
      { name: 'Statistics', code: 'STAT', slug: 'stat' },
      { name: 'Geology', code: 'GEOL', slug: 'geol' },
      { name: 'French', code: 'FREN', slug: 'fren' },
      { name: 'Religion & Philosophy', code: 'RELG', slug: 'relg' },
    ],
  },
  {
    name: 'Faculty of Health Sciences',
    slug: 'fhs',
    departments: [
      { name: 'Health Sciences', code: 'HSCI', slug: 'hsci' },
      { name: 'Nursing', code: 'NURS', slug: 'nurs' },
      { name: 'Public Health', code: 'PUBH', slug: 'pubh' },
    ],
  },
  {
    name: 'Faculty of Medicine',
    slug: 'fm',
    departments: [
      { name: 'Medicine', code: 'MDED', slug: 'mded' },
      { name: 'Biochemistry & Molecular Biology', code: 'BCHM', slug: 'bchm' },
      { name: 'Anatomy, Cell Biology & Physiology', code: 'ANAT', slug: 'anat' },
      { name: 'Pathology & Lab Medicine', code: 'PATH', slug: 'path' },
    ],
  },
  {
    name: 'Faculty of Agricultural & Food Sciences',
    slug: 'fafs',
    departments: [
      { name: 'Agriculture', code: 'AGRI', slug: 'agri' },
      { name: 'Animal & Veterinary Sciences', code: 'ANSC', slug: 'ansc' },
      { name: 'Plant Science', code: 'PLSC', slug: 'plsc' },
      { name: 'Food Technology', code: 'FTEC', slug: 'ftec' },
      { name: 'Nutrition & Food Sciences', code: 'NUSC', slug: 'nusc' },
    ],
  },
  {
    name: 'Faculty of Law, Civic & Political Science',
    slug: 'flcps',
    departments: [
      { name: 'Law', code: 'LAW', slug: 'law' },
    ],
  },
  {
    name: 'Maroun Semaan Faculty of Engineering – Additional',
    slug: 'fea-additional',
    departments: [
      { name: 'Industrial Engineering', code: 'INDE', slug: 'inde' },
      { name: 'Chemical Engineering', code: 'CHME', slug: 'chme' },
    ],
  },
  {
    name: 'Arts & Languages Institute',
    slug: 'ali',
    departments: [
      { name: 'Music', code: 'MUSA', slug: 'musa' },
      { name: 'Fine Arts & Art History', code: 'FNAR', slug: 'fnar' },
      { name: 'Communication Arts', code: 'COMM', slug: 'comm' },
      { name: 'German', code: 'GERM', slug: 'germ' },
      { name: 'Italian', code: 'ITAL', slug: 'ital' },
      { name: 'Greek & Latin', code: 'GREK', slug: 'grek' },
    ],
  },
]

// Mapping from subject prefix → department code (for findDepartment in engine.ts)
// We handle this ourselves in the sync script by building our own lookup table.
const SUBJECT_TO_DEPT_CODE: Record<string, string> = {
  // Core sciences
  BIOL: 'BIOL', CHEM: 'CHEM', CMPS: 'CMPS', ECON: 'ECON',
  MATH: 'MATH', PHYS: 'PHYS', PSYC: 'PSYC',
  // Engineering
  ARCH: 'ARCH', CVLE: 'CVLE', EECE: 'EECE', MCHE: 'MCHE',
  // Business
  ACCT: 'ACCT', BUSS: 'BUSS', FMSE: 'FMSE', MKTG: 'MKTG',
  // Humanities & Social Sciences
  ARAB: 'ARAB', ENGL: 'ENGL', HIST: 'HIST', PHIL: 'PHIL',
  PSPA: 'PSPA', SOAN: 'SOAN', STAT: 'STAT', GEOL: 'GEOL',
  FREN: 'FREN', RELG: 'RELG',
  // Health Sciences
  NURS: 'NURS', PUBH: 'PUBH', HSCI: 'HSCI',
  // Medicine
  MDED: 'MDED', BCHM: 'BCHM', ANAT: 'ANAT', PATH: 'PATH',
  // Agriculture & Food
  AGRI: 'AGRI', ANSC: 'ANSC', PLSC: 'PLSC', FTEC: 'FTEC', NUSC: 'NUSC',
  // Law
  LAW: 'LAW',
  // Engineering additional
  INDE: 'INDE', CHME: 'CHME',
  // Arts & Languages
  MUSA: 'MUSA', FNAR: 'FNAR', COMM: 'COMM', GERM: 'GERM',
  ITAL: 'ITAL', GREK: 'GREK',

  // ── Aliases & alternate prefixes ────────────────────────────────────────────
  // Political Science
  POLS: 'PSPA', PPIA: 'PSPA', INT: 'PSPA',
  // Business aliases
  MANG: 'BUSS', BUS: 'BUSS', MGMT: 'BUSS', BUAD: 'BUSS', BACC: 'ACCT',
  MSBA: 'FMSE', MFIN: 'FMSE', HROB: 'BUSS', MNGT: 'BUSS', MCOM: 'COMM',
  // CS/Engineering aliases
  CS: 'CMPS', COMS: 'CMPS', DSCI: 'CMPS', HDSC: 'CMPS',
  EE: 'EECE', BMEN: 'EECE', ENMG: 'INDE',
  CE: 'CVLE', CIVE: 'CVLE', ENVS: 'CVLE',
  ME: 'MCHE', MECH: 'MCHE',
  SARC: 'ARCH', ARC: 'ARCH',
  CHEN: 'CHME',
  // Math/Science aliases
  MTH: 'MATH', MACT: 'MATH',
  BIOC: 'BCHM',
  NFSC: 'NUSC', AGSC: 'AGRI', AGRN: 'AGRI', HORT: 'PLSC',
  SCI: 'BIOL',
  // Health aliases
  PHAR: 'HSCI', PHARM: 'HSCI',
  PBHL: 'PUBH', EPHD: 'PUBH',
  MEDC: 'MDED',
  // Language aliases
  ARBC: 'ARAB', NESC: 'ARAB', TURK: 'ARAB', CHIN: 'ARAB', JAPN: 'ARAB',
  RUSS: 'GERM', SPAN: 'FREN',
  MUSC: 'MUSA', MUS: 'MUSA',
  ART: 'FNAR', CMTS: 'COMM',
  // Social Sciences aliases
  SOWK: 'SOAN', ANTH: 'SOAN', EDUC: 'SOAN',
  WGSS: 'SOAN', JWST: 'HIST', LESL: 'HIST', AMST: 'ENGL',
  GEOG: 'GEOL',
  // Remaining AUB-specific prefixes
  CHLA: 'ARAB',   // Colloquial Lebanese Arabic
  MEST: 'ARAB',   // Middle Eastern Studies
  FINA: 'FNAR',   // Fine Arts
  AHIS: 'FNAR',   // Art History
  AROL: 'ARCH',   // Architectural Studies / Landscape
  HMPD: 'PUBH',   // Health Management & Policy Development
  HPCH: 'PUBH',   // Health Promotion & Community Health
  FSEC: 'AGRI',   // Food Security
  ENSC: 'GEOL',   // Environmental Science
  ENST: 'GEOL',   // Environmental Studies
  BIOM: 'EECE',   // Biomedical (Engineering)
  MBIM: 'BCHM',   // Molecular Biology & Immunology
  PHYL: 'ANAT',   // Physiology
  DCSN: 'FMSE',   // Decision Sciences
  HUMR: 'LAW',    // Human Rights
  LDEM: 'PSPA',   // Leadership & Democracy
  GRDS: 'CMPS',   // Graduate/Interdisciplinary (default to CMPS)
  VIPP: 'ARCH',   // Visual & Performing Arts (Landscape/Design)
  SHRP: 'BUSS',   // Strategic HR & Policy
  EXCH: 'CMPS',   // Exchange/Interdisciplinary
  // Small/specialized AUB programs
  URPL: 'ARCH',   // Urban Planning
  URDS: 'ARCH',   // Urban Design Studies
  ENHL: 'PUBH',   // Environmental Health
  LABM: 'PATH',   // Laboratory Medicine
  MIMG: 'PATH',   // Medical Imaging
  MLSP: 'PATH',   // Medical Lab Sciences/Policy
  INFO: 'CMPS',   // Information Management
  ISLM: 'ARAB',   // Islamic Studies
  PHNU: 'NUSC',   // Pharmaceutical Nutrition
  AVSC: 'ANSC',   // Animal & Veterinary Sciences (Avian)
  CPSY: 'PSYC',   // Clinical Psychology
  RCOD: 'HSCI',   // Rehabilitation/Communication Disorders
  ENTM: 'BIOL',   // Entomology
  HEHI: 'PUBH',   // Health & Human Interaction
  PHRM: 'HSCI',   // Pharmacy
  AGBU: 'AGRI',   // Agribusiness
  FEAA: 'ECON',   // Financial Economics & Applied Analytics
  MHRM: 'BUSS',   // Management/Human Resources
  ODFO: 'NUSC',   // Occupational & Food Sciences
  ARDS: 'ARCH',   // Architectural Design Studies
  // Final tiny programs (≤5 sections each)
  SART: 'FNAR',   // Studio Art
  THTR: 'COMM',   // Theatre
  UPEN: 'ARCH',   // Urban Planning (Environment)
  UPIT: 'ARCH',   // Urban Planning (Infrastructure/IT)
  UPHU: 'ARCH',   // Urban Planning (Health/Urban)
  UPMA: 'ARCH',   // Urban Planning Management
  UPGR: 'ARCH',   // Urban Planning Graduate
  INFP: 'CMPS',   // Information Policy
  MSCU: 'MDED',   // Medical/Surgical Curriculum
  PSYT: 'PSYC',   // Psychiatry
  IPEC: 'ECON',   // International Political Economy
  EHCL: 'PUBH',   // Environmental Health
  EXPR: 'BIOL',   // Experimental/Research
  FSAF: 'AGRI',   // Food Safety
  DGRG: 'GEOL',   // Degree/Graduate (Geology related)
}

async function ensureDepartments(aubId: string): Promise<Map<string, string>> {
  // Returns map of dept code → dept id
  const university = await prisma.university.findUnique({
    where: { id: aubId },
    include: { faculties: { include: { departments: true } } },
  })
  if (!university) throw new Error('AUB not found')

  const deptMap = new Map<string, string>()

  // Collect existing
  for (const fac of university.faculties) {
    for (const dept of fac.departments) {
      if (dept.code) deptMap.set(dept.code, dept.id)
    }
  }

  console.log(`  Existing departments: ${deptMap.size}`)

  // Add missing faculties/departments
  for (const facSpec of MISSING_FACULTIES) {
    let faculty = university.faculties.find(f => f.slug === facSpec.slug)
    if (!faculty) {
      faculty = await prisma.faculty.create({
        data: { name: facSpec.name, slug: facSpec.slug, universityId: aubId },
        include: { departments: true },
      }) as typeof university.faculties[0]
      console.log(`  Created faculty: ${facSpec.name}`)
    }

    for (const deptSpec of facSpec.departments) {
      if (!deptMap.has(deptSpec.code)) {
        const existing = await prisma.department.findFirst({
          where: { facultyId: faculty.id, slug: deptSpec.slug },
        })
        if (!existing) {
          const dept = await prisma.department.create({
            data: {
              name: deptSpec.name,
              code: deptSpec.code,
              slug: deptSpec.slug,
              facultyId: faculty.id,
            },
          })
          deptMap.set(dept.code!, dept.id)
          console.log(`    Created dept: ${deptSpec.code} – ${deptSpec.name}`)
        } else {
          deptMap.set(deptSpec.code, existing.id)
        }
      }
    }
  }

  console.log(`  Total departments after migration: ${deptMap.size}`)
  return deptMap
}

// ── AUB Catalog Scraper ───────────────────────────────────────────────────────

const CATALOG_BASE = 'https://www-banner.aub.edu.lb/catalog'
const CATALOG_INDEX = `${CATALOG_BASE}/schedule_header.html`

const DAY_COL_MAP = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

const COL = {
  TERM: 0, CRN: 1, SUBJECT: 2, CODE: 3, SECTION: 4, TITLE: 5, CREDITS: 6,
  ENROLLED: 9, SEATS: 10, BEGIN1: 11, END1: 12, BUILDING1: 13, ROOM1: 14,
  DAYS1: 15, LE1: 21, BEGIN2: 22, END2: 23, BUILDING2: 24, ROOM2: 25,
  DAYS2: 26, LE2: 32, INST_FIRST: 33, INST_LAST: 34,
}

function parseAUBTime(t: string): string | null {
  if (!t || t === '.' || t.length < 3) return null
  const padded = t.padStart(4, '0')
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
}

interface FetchedSection {
  crn: string
  subject: string
  code: string
  sectionNum: string
  title: string
  credits: number | undefined
  enrolled: number | undefined
  seatsRemaining: number | undefined
  status: 'OPEN' | 'CLOSED' | 'UNKNOWN'
  instructorName: string | null
  meetings: Array<{ day: string; startTime: string; endTime: string; type: string; location: string | undefined }>
}

function parseCatalogPage(html: string, bannerTerm: string): FetchedSection[] {
  const $ = cheerio.load(html)
  const results: FetchedSection[] = []
  const tables = $('table')
  if (tables.length < 2) return results

  tables.eq(1).find('tr').slice(2).each((_i, tr) => {
    const cells = $(tr).find('td')
    if (cells.length < 35) return

    const cell = (idx: number) => $(cells[idx]).text().trim()
    const termMatch = cell(COL.TERM).match(/\((\d{6})\)/)
    if (!termMatch || termMatch[1] !== bannerTerm) return

    const crn = cell(COL.CRN)
    const subject = cell(COL.SUBJECT)
    const code = cell(COL.CODE)
    if (!crn || !subject || !code) return

    const enrolled = parseInt(cell(COL.ENROLLED)) || undefined
    const seatsAvail = parseInt(cell(COL.SEATS))
    const seatsRemaining = isNaN(seatsAvail) ? undefined : seatsAvail
    const status: FetchedSection['status'] = seatsRemaining == null ? 'UNKNOWN' : seatsRemaining > 0 ? 'OPEN' : 'CLOSED'

    const days1 = Array.from({ length: 6 }, (_, d) => $(cells[COL.DAYS1 + d]).text().trim())
    const days2 = Array.from({ length: 6 }, (_, d) => $(cells[COL.DAYS2 + d]).text().trim())

    const meetings: FetchedSection['meetings'] = []

    for (const [begin, end, bldg, room, days, le] of [
      [cell(COL.BEGIN1), cell(COL.END1), cell(COL.BUILDING1), cell(COL.ROOM1), days1, cell(COL.LE1)],
      [cell(COL.BEGIN2), cell(COL.END2), cell(COL.BUILDING2), cell(COL.ROOM2), days2, cell(COL.LE2)],
    ] as [string, string, string, string, string[], string][]) {
      const st = parseAUBTime(begin)
      const et = parseAUBTime(end)
      if (!st || !et) continue
      const location = [bldg, room].filter(v => v && v !== '.').join(' ') || undefined
      const type = le && le !== '.' ? le : 'LECTURE'
      for (let d = 0; d < 6; d++) {
        if (days[d] && days[d] !== '.') {
          meetings.push({ day: DAY_COL_MAP[d], startTime: st, endTime: et, type, location })
        }
      }
    }

    const firstName = cell(COL.INST_FIRST)
    const lastName = cell(COL.INST_LAST)
    const instructorName = (firstName && firstName !== '.' && lastName && lastName !== '.')
      ? `${firstName} ${lastName}`.trim()
      : null

    results.push({
      crn,
      subject,
      code: `${subject} ${code}`,
      sectionNum: cell(COL.SECTION),
      title: cell(COL.TITLE),
      credits: parseInt(cell(COL.CREDITS)) || undefined,
      enrolled,
      seatsRemaining,
      status,
      instructorName,
      meetings,
    })
  })

  return results
}

async function fetchFullCatalog(bannerTerm: string): Promise<FetchedSection[]> {
  // Verify index
  const idxRes = await fetch(CATALOG_INDEX, { signal: AbortSignal.timeout(15000) })
  if (!idxRes.ok) throw new Error(`Catalog index HTTP ${idxRes.status}`)
  const idxHtml = await idxRes.text()
  const availableTerms = [...idxHtml.matchAll(/(\d{6}):/g)].map(m => m[1])
  if (!availableTerms.includes(bannerTerm)) {
    throw new Error(`Term ${bannerTerm} not in catalog. Available: ${availableTerms.join(', ')}`)
  }

  const allSections: FetchedSection[] = []
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  let totalFetched = 0

  // Batch 4 concurrent fetches
  for (let i = 0; i < letters.length; i += 4) {
    const batch = letters.slice(i, i + 4)
    const results = await Promise.allSettled(
      batch.map(async letter => {
        const url = `${CATALOG_BASE}/schd_${letter}.htm`
        const res = await fetch(url, { signal: AbortSignal.timeout(40000) })
        if (!res.ok) return [] as FetchedSection[]
        const html = await res.text()
        return parseCatalogPage(html, bannerTerm)
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        allSections.push(...r.value)
        totalFetched += r.value.length
      }
    }
    process.stdout.write(`  Fetched letters ${batch.join('')}: ${totalFetched} sections so far\r`)
  }

  console.log(`\n  Catalog fetch complete: ${allSections.length} sections`)
  return allSections
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function getOrCreateTerm(aubId: string, bannerTerm: string) {
  const season = bannerTerm.endsWith('20') ? 'SPRING' : bannerTerm.endsWith('10') ? 'FALL' : 'SUMMER'
  const baseYear = parseInt(bannerTerm.slice(0, 4))
  const year = season === 'SPRING' ? baseYear : baseYear

  const existing = await prisma.academicTerm.findFirst({
    where: { season, year, universityId: aubId },
  })
  if (existing) return existing

  return prisma.academicTerm.create({
    data: {
      name: `${season} ${year}`,
      season,
      year,
      universityId: aubId,
      isCurrent: true,
      isActive: true,
    },
  })
}

async function upsertProfessor(name: string, deptId: string): Promise<string> {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return ''
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  const fullName = `${firstName} ${lastName}`

  const existing = await prisma.professor.findFirst({
    where: { firstName, lastName, departmentId: deptId },
  })
  if (existing) {
    await prisma.professor.update({ where: { id: existing.id }, data: { lastSyncedAt: new Date() } })
    return existing.id
  }

  const base = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${lastName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  let slug = base
  let n = 0
  while (await prisma.professor.findUnique({ where: { slug } })) { n++; slug = `${base}-${n}` }

  const prof = await prisma.professor.create({
    data: { firstName, lastName, fullName, slug, departmentId: deptId, lastSyncedAt: new Date() },
  })
  return prof.id
}

async function upsertCourse(code: string, name: string, deptId: string, aubSlug: string): Promise<string> {
  const existing = await prisma.course.findFirst({
    where: { code, departmentId: deptId },
  })
  if (existing) {
    await prisma.course.update({ where: { id: existing.id }, data: { name, isActive: true } })
    return existing.id
  }

  const baseSlug = `${code.replace(/\s+/g, '-').toLowerCase()}-${aubSlug}`
  let slug = baseSlug
  let n = 0
  // Find courses with same base slug to handle collisions
  while (true) {
    const conflict = await prisma.course.findFirst({ where: { slug } })
    if (!conflict) break
    n++
    slug = `${baseSlug}-${n}`
  }

  const course = await prisma.course.create({
    data: { code, name, slug, departmentId: deptId, isActive: true },
  })
  return course.id
}

async function main() {
  const TERM_CODE = 'SPRING-2026'
  const BANNER_TERM = '202620'

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  AUB Full Sync – Complete Catalog Ingestion')
  console.log(`  Term: ${TERM_CODE} (Banner: ${BANNER_TERM})`)
  console.log('══════════════════════════════════════════════════════\n')

  const aub = await prisma.university.findUnique({ where: { slug: 'aub' } })
  if (!aub) throw new Error('AUB not found in DB')

  // Step 1: Ensure all departments exist
  console.log('Step 1: Ensuring all AUB departments exist...')
  const deptMap = await ensureDepartments(aub.id)  // code → id

  // Step 2: Fetch live catalog
  console.log('\nStep 2: Fetching AUB public catalog...')
  let catalogSections: FetchedSection[]
  try {
    catalogSections = await fetchFullCatalog(BANNER_TERM)
  } catch (err) {
    console.error('Catalog fetch failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  // Step 3: Get/create academic term
  console.log('\nStep 3: Ensuring academic term exists...')
  const term = await getOrCreateTerm(aub.id, BANNER_TERM)
  console.log(`  Term: ${term.name} (id: ${term.id})`)

  // Step 4: Clean up previously BIOL-fallback courses that now have proper dept mappings
  console.log('\nStep 4: Cleaning up previously misrouted courses...')
  const newlyMappedSubjects = Object.keys(SUBJECT_TO_DEPT_CODE).filter(
    subj => SUBJECT_TO_DEPT_CODE[subj] !== 'BIOL'
  )
  let cleanedCourses = 0
  for (const subj of newlyMappedSubjects) {
    // Find courses under BIOL dept where code starts with this subject prefix
    const biolDeptId = deptMap.get('BIOL')
    if (!biolDeptId) continue
    const misrouted = await prisma.course.findMany({
      where: { code: { startsWith: `${subj} ` }, departmentId: biolDeptId },
      include: { sections: { select: { id: true } } },
    })
    for (const course of misrouted) {
      // Delete associated sections first (cascade)
      if (course.sections.length > 0) {
        await prisma.sectionMeeting.deleteMany({ where: { sectionId: { in: course.sections.map(s => s.id) } } })
        await prisma.sectionProfessor.deleteMany({ where: { sectionId: { in: course.sections.map(s => s.id) } } })
        await prisma.section.deleteMany({ where: { id: { in: course.sections.map(s => s.id) } } })
      }
      await prisma.course.delete({ where: { id: course.id } })
      cleanedCourses++
    }
  }
  if (cleanedCourses > 0) console.log(`  Removed ${cleanedCourses} misrouted courses (were under BIOL dept)`)
  else console.log('  No misrouted courses to clean up')

  // Step 5: Sync all sections
  console.log('\nStep 5: Syncing sections to database...')

  let added = 0, updated = 0, skipped = 0, errors = 0
  const syncedSectionIds: string[] = []
  const subjectStats = new Map<string, { courses: Set<string>; sections: number; profs: Set<string> }>()
  const unknownSubjects = new Map<string, number>()

  for (const sec of catalogSections) {
    try {
      // Find department for this subject
      const deptCode = SUBJECT_TO_DEPT_CODE[sec.subject] ?? null
      let deptId = deptCode ? deptMap.get(deptCode) ?? null : null

      if (!deptId) {
        // Unknown subject prefix — route to BIOL as last resort but track it
        unknownSubjects.set(sec.subject, (unknownSubjects.get(sec.subject) ?? 0) + 1)
        deptId = deptMap.get('BIOL') ?? null
        if (!deptId) { skipped++; continue }
      }

      // Upsert course
      const courseId = await upsertCourse(sec.code, sec.title || sec.code, deptId, 'aub')

      // Upsert professor
      const professorIds: string[] = []
      if (sec.instructorName) {
        const profId = await upsertProfessor(sec.instructorName, deptId)
        if (profId) professorIds.push(profId)
      }

      // Upsert section
      const existingSec = await prisma.section.findFirst({
        where: { courseId, termId: term.id, sectionNumber: sec.sectionNum },
      })

      const qualityFields = {
        enrolled: sec.enrolled,
        seatsRemaining: sec.seatsRemaining,
        status: sec.status,
        sourceConnector: 'aub-catalog',
        sourceIdentifier: sec.crn,
        historicalInference: false,
        completenessScore: sec.meetings.length > 0 && sec.instructorName ? 0.8 : 0.5,
        dataQualityStatus: sec.instructorName && sec.meetings.length > 0 ? 'PARTIAL' : 'MINIMAL',
        isStale: false,
        lastSyncedAt: new Date(),
      }

      let sectionId: string

      if (existingSec) {
        await prisma.section.update({ where: { id: existingSec.id }, data: { crn: sec.crn, capacity: sec.enrolled != null && sec.seatsRemaining != null ? sec.enrolled + sec.seatsRemaining : undefined, ...qualityFields } })
        await prisma.sectionMeeting.deleteMany({ where: { sectionId: existingSec.id } })
        await prisma.sectionProfessor.deleteMany({ where: { sectionId: existingSec.id } })
        sectionId = existingSec.id
        updated++
      } else {
        const newSec = await prisma.section.create({
          data: {
            courseId,
            termId: term.id,
            sectionNumber: sec.sectionNum,
            crn: sec.crn,
            capacity: sec.enrolled != null && sec.seatsRemaining != null ? sec.enrolled + sec.seatsRemaining : undefined,
            ...qualityFields,
          },
        })
        sectionId = newSec.id
        added++
      }

      // Create meetings
      if (sec.meetings.length > 0) {
        await prisma.sectionMeeting.createMany({
          data: sec.meetings.map(m => ({
            sectionId,
            day: m.day,
            startTime: m.startTime,
            endTime: m.endTime,
            type: m.type,
            location: m.location ?? null,
          })),
        })
      }

      // Create professor assignments
      for (const profId of professorIds) {
        await prisma.sectionProfessor.create({
          data: { sectionId, professorId: profId, isPrimary: true, confidence: 'CONFIRMED' },
        })
        await prisma.professorCourse.upsert({
          where: { professorId_courseId: { professorId: profId, courseId } },
          update: {},
          create: { professorId: profId, courseId },
        })
      }

      syncedSectionIds.push(sectionId)

      // Track subject stats
      if (!subjectStats.has(sec.subject)) subjectStats.set(sec.subject, { courses: new Set(), sections: 0, profs: new Set() })
      const s = subjectStats.get(sec.subject)!
      s.courses.add(sec.code)
      s.sections++
      if (sec.instructorName) s.profs.add(sec.instructorName)

    } catch (err) {
      errors++
      if (errors <= 5) console.error(`  Section ${sec.crn} error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Step 6: Coverage report
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  AUB COVERAGE REPORT')
  console.log('══════════════════════════════════════════════════════')
  console.log(`\nSync results: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} errors`)

  const subjects = [...subjectStats.entries()].sort((a, b) => b[1].sections - a[1].sections)
  const totalSubjects = subjects.length
  const totalCourses = subjects.reduce((s, [, v]) => s + v.courses.size, 0)
  const totalSections = subjects.reduce((s, [, v]) => s + v.sections, 0)
  const totalProfs = new Set(subjects.flatMap(([, v]) => [...v.profs])).size
  const confirmedSections = subjects.reduce((s, [, v]) => s + (v.profs.size > 0 ? v.sections : 0), 0)

  console.log(`\n  Total subjects ingested:  ${totalSubjects}`)
  console.log(`  Total courses ingested:   ${totalCourses}`)
  console.log(`  Total sections ingested:  ${totalSections}`)
  console.log(`  Total professors found:   ${totalProfs}`)
  console.log(`  Confirmed rate:           ${totalSections > 0 ? Math.round((confirmedSections / totalSections) * 100) : 0}%`)

  console.log('\n  Subject breakdown (top 30 by section count):')
  console.log('  ' + 'Subject'.padEnd(8) + 'Courses'.padStart(9) + 'Sections'.padStart(10) + 'Profs'.padStart(8) + '  Dept Mapped')
  console.log('  ' + '─'.repeat(60))
  for (const [subj, stats] of subjects.slice(0, 30)) {
    const deptCode = SUBJECT_TO_DEPT_CODE[subj] ?? '???'
    const mapped = deptCode !== '???' ? '✓' : '⚠ BIOL fallback'
    console.log(
      '  ' + subj.padEnd(8) +
      String(stats.courses.size).padStart(9) +
      String(stats.sections).padStart(10) +
      String(stats.profs.size).padStart(8) +
      `  ${deptCode} ${mapped}`
    )
  }

  // Check specifically requested subjects
  console.log('\n  Specifically requested subject coverage:')
  const CHECK = ['PSPA', 'POLS', 'HIST', 'ECON', 'SOAN', 'ARAB', 'ENGL', 'PHIL', 'PSYC']
  for (const subj of CHECK) {
    const stats = subjectStats.get(subj)
    if (stats) {
      const pct = stats.sections > 0 ? Math.round((stats.profs.size / stats.sections) * 100) : 0
      console.log(`  ✅ ${subj.padEnd(6)} ${stats.sections} sections, ${stats.courses.size} courses, ${stats.profs.size} profs (${pct}% assigned)`)
    } else {
      console.log(`  ❌ ${subj.padEnd(6)} NOT FOUND in catalog`)
    }
  }

  if (unknownSubjects.size > 0) {
    console.log(`\n  Subjects routed to BIOL fallback (${unknownSubjects.size} prefixes):`)
    for (const [subj, count] of [...unknownSubjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`    ${subj.padEnd(8)} ${count} sections`)
    }
    console.log(`  → Add these to SUBJECT_TO_DEPT_CODE in next run`)
  }

  await prisma.$disconnect()
  console.log('\n  ✅ AUB sync complete\n')
}

main().catch(e => { console.error(e); process.exit(1) })
