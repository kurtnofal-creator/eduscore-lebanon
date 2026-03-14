import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SearchBar } from '@/components/search/SearchBar'
import { ProfessorCard } from '@/components/professors/ProfessorCard'
import { AdBanner } from '@/components/ads/AdBanner'
import {
  Star, BookOpen, Calendar, Shield, TrendingUp, Users, ArrowRight,
  CheckCircle, Zap, Award, Database, MessageSquare, Clock, Copy,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'EduScore Lebanon – Professor Reviews & Schedule Planner',
  description: 'Find professor reviews, compare courses, and build conflict-free schedules at AUB, LAU, USJ, LIU, NDU, BAU, and other Lebanese universities.',
}

const LIVE_SLUGS = new Set(['aub', 'lau'])

async function getHomePageData() {
  const [topProfessors, mostReviewed, recentlyReviewed, stats, universities, sectionCount] = await Promise.all([
    prisma.professor.findMany({
      where: { isActive: true, isMerged: false },
      orderBy: { overallRating: 'desc' },
      take: 8,
      select: {
        id: true, fullName: true, slug: true, title: true,
        overallRating: true, workloadLevel: true, reviewCount: true, recommendRate: true,
        department: { select: { name: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } } },
      },
    }),
    prisma.professor.findMany({
      where: { isActive: true, isMerged: false, reviewCount: { gt: 0 } },
      orderBy: { reviewCount: 'desc' },
      take: 8,
      select: {
        id: true, fullName: true, slug: true, title: true,
        overallRating: true, workloadLevel: true, reviewCount: true, recommendRate: true,
        department: { select: { name: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } } },
      },
    }),
    prisma.review.findMany({
      where: { status: 'APPROVED', professorId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      distinct: ['professorId'],
      select: {
        professor: {
          select: {
            id: true, fullName: true, slug: true, title: true,
            overallRating: true, workloadLevel: true, reviewCount: true, recommendRate: true,
            department: { select: { name: true, faculty: { select: { university: { select: { shortName: true, slug: true } } } } } },
          },
        },
      },
    }),
    Promise.all([
      prisma.professor.count({ where: { isActive: true } }),
      prisma.course.count({ where: { isActive: true } }),
      prisma.review.count({ where: { status: 'APPROVED' } }),
      prisma.university.count({ where: { isActive: true } }),
    ]),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, slug: true, city: true },
      orderBy: { shortName: 'asc' },
    }),
    prisma.section.count({ where: { isActive: true } }),
  ])

  const recentProfs = recentlyReviewed
    .map(r => r.professor)
    .filter(Boolean)
    .slice(0, 8) as typeof topProfessors

  return { topProfessors, mostReviewed, recentlyReviewed: recentProfs, stats, universities, sectionCount }
}

export default async function HomePage() {
  const {
    topProfessors,
    mostReviewed,
    recentlyReviewed,
    stats: [profCount, courseCount, reviewCount, uniCount],
    universities,
    sectionCount,
  } = await getHomePageData()

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="hero-gradient border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-600 tracking-wide">Lebanon&apos;s #1 Academic Review Platform</span>
          </div>

          {/* Headline */}
          <h1
            className="hero-heading font-bold text-slate-900 tracking-tight mb-5"
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4rem)',
              fontFamily: 'Poppins, sans-serif',
              lineHeight: 1.06,
            }}
          >
            Build the best class schedule<br />
            <span className="gradient-text">at AUB and LAU.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Compare professors, generate schedules, and copy CRNs for registration.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link
              href="/schedule-builder"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-[15px] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <Calendar className="h-4 w-4" /> Build My Schedule
            </Link>
            <Link
              href="/professors"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-[15px] border border-slate-200 transition-all shadow-sm hover:shadow-md"
            >
              <Users className="h-4 w-4" /> Browse Professors
            </Link>
          </div>

          {/* Search */}
          <div className="max-w-2xl mx-auto mb-8">
            <SearchBar
              placeholder="Search a professor, course, or university…"
              large
            />
          </div>

          {/* University chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {universities.map(u => {
              const isLive = LIVE_SLUGS.has(u.slug)
              return (
                <Link
                  key={u.id}
                  href={`/universities/${u.slug}`}
                  className={
                    isLive
                      ? 'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-green-200 bg-green-50 text-[13px] font-semibold text-green-700 hover:border-green-300 hover:bg-green-100 transition-all shadow-sm'
                      : 'px-4 py-1.5 rounded-full border border-slate-200 bg-white text-[13px] font-semibold text-slate-500 hover:border-blue-200 hover:text-blue-700 hover:bg-blue-50 transition-all shadow-sm hover:shadow-blue-100'
                  }
                >
                  {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                  {u.shortName}
                  {isLive && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Live</span>}
                </Link>
              )
            })}
          </div>

          {/* Stats row */}
          <div className="w-full max-w-2xl mx-auto grid grid-cols-3 sm:grid-cols-5 gap-px bg-slate-200/60 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {[
              { n: `${profCount.toLocaleString()}+`,    label: 'Professors',        icon: Users         },
              { n: `${courseCount.toLocaleString()}+`,  label: 'Courses',           icon: BookOpen      },
              { n: `${sectionCount.toLocaleString()}+`, label: 'Sections',          icon: Database      },
              { n: `${reviewCount.toLocaleString()}+`,  label: 'Reviews',           icon: MessageSquare },
              { n: '2',                                  label: 'Live Universities', icon: Award         },
            ].map(({ n, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 bg-white px-3 sm:px-5 py-4 justify-center sm:justify-start">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-900 text-[13px] sm:text-[15px] leading-none tabular-nums" style={{ fontFamily: 'Poppins, sans-serif' }}>{n}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHEDULE BUILDER DEMO ────────────────────────────────────── */}
      <section className="py-20 bg-white border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

            {/* Left: copy */}
            <div>
              <p className="section-label mb-3">Schedule builder</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-5 leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Every valid schedule,<br />ranked for you.
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Add your courses, hit Generate, and EduScore instantly finds every conflict-free combination — ranked by professor ratings, fewest campus days, or lightest workload.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  'No more manually checking time conflicts',
                  'Ranked by professor ratings and preferences',
                  'One-click CRN copy for instant registration',
                  'Live section data from AUB and LAU registrar',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/schedule-builder" className="btn-primary text-sm inline-flex gap-2">
                <Calendar className="h-4 w-4" /> Try Schedule Builder
              </Link>
            </div>

            {/* Right: mock UI */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl blur-2xl opacity-60" />
              <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

                {/* Mock header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <span className="text-xs text-slate-400 ml-2">Schedule 1 of 12</span>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Score 94</span>
                </div>

                {/* Mock stats strip */}
                <div className="flex gap-5 px-4 py-2.5 bg-white border-b border-slate-100 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3 text-slate-400" /><strong className="text-slate-700">15</strong> credits</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" /><strong className="text-slate-700">4</strong> campus days</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /><strong className="text-slate-700">8:00 – 17:00</strong></span>
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /><strong className="text-slate-700">4.2</strong> avg prof</span>
                </div>

                {/* Mock week calendar */}
                <div className="px-4 py-3">
                  <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold text-slate-400 text-center mb-1">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI'].map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-5 gap-1 h-28">
                    {/* MON */}
                    <div className="flex flex-col gap-1">
                      <div className="rounded-lg bg-blue-100 border border-blue-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-blue-700 leading-tight">CMPS 201</p>
                        <p className="text-[8px] text-blue-500">8:00–9:15</p>
                      </div>
                    </div>
                    {/* TUE */}
                    <div className="flex flex-col gap-1">
                      <div className="rounded-lg bg-violet-100 border border-violet-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-violet-700 leading-tight">MATH 201</p>
                        <p className="text-[8px] text-violet-500">10:00–11:15</p>
                      </div>
                    </div>
                    {/* WED */}
                    <div className="flex flex-col gap-1">
                      <div className="rounded-lg bg-blue-100 border border-blue-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-blue-700 leading-tight">CMPS 201</p>
                        <p className="text-[8px] text-blue-500">8:00–9:15</p>
                      </div>
                      <div className="rounded-lg bg-emerald-100 border border-emerald-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-emerald-700 leading-tight">EECE 230</p>
                        <p className="text-[8px] text-emerald-500">14:00–15:15</p>
                      </div>
                    </div>
                    {/* THU */}
                    <div className="flex flex-col gap-1">
                      <div className="rounded-lg bg-violet-100 border border-violet-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-violet-700 leading-tight">MATH 201</p>
                        <p className="text-[8px] text-violet-500">10:00–11:15</p>
                      </div>
                      <div className="rounded-lg bg-amber-100 border border-amber-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-amber-700 leading-tight">ENGL 102</p>
                        <p className="text-[8px] text-amber-500">13:00–14:15</p>
                      </div>
                    </div>
                    {/* FRI */}
                    <div className="flex flex-col gap-1">
                      <div className="rounded-lg bg-emerald-100 border border-emerald-200 p-1.5 flex-1">
                        <p className="text-[9px] font-bold text-emerald-700 leading-tight">EECE 230</p>
                        <p className="text-[8px] text-emerald-500">9:00–10:15</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock CRN copy strip */}
                <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 font-mono">CRNs: 10234, 10891, 11042, 11340</div>
                  <button className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                    <Copy className="h-2.5 w-2.5" /> Copy CRNs
                  </button>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -right-4 bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-700">Live AUB Data</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="section-label mb-3">How it works</p>
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Three steps to a better semester
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                n: '01', icon: Star, title: 'Research professors',
                desc: 'Read anonymous student reviews covering teaching quality, grading fairness, workload, attendance policy, and exam difficulty.',
              },
              {
                n: '02', icon: BookOpen, title: 'Compare courses',
                desc: 'Side-by-side professor comparison for the same course. See who grades easiest, teaches clearest, and gets the most recommendations.',
              },
              {
                n: '03', icon: Calendar, title: 'Build your schedule',
                desc: 'Drop in your courses and generate all valid combinations. Rank results by best professors, fewest campus days, or shortest gaps.',
              },
            ].map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="relative es-card p-7 group">
                {/* Step number */}
                <div className="absolute top-4 right-4 text-[11px] font-bold text-slate-300/70 font-mono tracking-[0.15em] select-none" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 28, lineHeight: 1 }}>{n}</div>
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-5 transition-colors group-hover:bg-blue-600">
                  <Icon className="h-5 w-5 text-blue-600 transition-colors group-hover:text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 text-[17px] mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP RATED PROFESSORS ──────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-y border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="section-label mb-2">Community picks</p>
              <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Top-Rated Professors</h2>
            </div>
            <Link href="/professors" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {topProfessors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {topProfessors.map(prof => <ProfessorCard key={prof.id} professor={prof} />)}
            </div>
          ) : (
            <div className="es-card p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-500 mb-4">No professor data yet. Be the first to submit a review!</p>
              <Link href="/login" className="btn-primary inline-flex text-sm">Write First Review <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
        </div>
      </section>

      {/* ── MOST REVIEWED PROFESSORS ─────────────────────────────────── */}
      {mostReviewed.length > 0 && (
        <section className="py-20 bg-white border-b border-slate-200/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">Most talked about</p>
                <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Most Reviewed Professors</h2>
              </div>
              <Link href="/professors?sort=reviews" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mostReviewed.map(prof => <ProfessorCard key={prof.id} professor={prof} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── RECENTLY REVIEWED PROFESSORS ─────────────────────────────── */}
      {recentlyReviewed.length > 0 && (
        <section className="py-20 bg-slate-50 border-b border-slate-200/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">Fresh takes</p>
                <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Recently Reviewed</h2>
              </div>
              <Link href="/professors?sort=recent" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentlyReviewed.map(prof => <ProfessorCard key={prof.id} professor={prof} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── AD ────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AdBanner slot="homepage-middle" className="h-24 rounded-2xl overflow-hidden" />
      </div>

      {/* ── BROWSE BY UNIVERSITY ──────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">Supported schools</p>
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Browse by University</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {universities.map(uni => {
              const isLive = LIVE_SLUGS.has(uni.slug)
              return (
                <Link
                  key={uni.id}
                  href={`/universities/${uni.slug}`}
                  className="es-card es-card-link p-5 flex flex-col items-center gap-3 text-center group cursor-pointer relative"
                >
                  {isLive && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5 leading-none">
                      Live
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-sm transition-all group-hover:bg-blue-600 group-hover:text-white">
                    {uni.shortName.slice(0, 3)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{uni.shortName}</p>
                    {uni.city && <p className="text-xs text-slate-400 mt-0.5">{uni.city}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── TRUST / WHY US ───────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-y border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            {/* Left: copy + checklist + buttons */}
            <div>
              <p className="section-label mb-3">Why students trust us</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-5 leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Reviews worth reading
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Every review is screened by automated filters and human moderators before publishing.
                We enforce strict community guidelines so you get honest, useful feedback — not noise.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  'Anonymous submissions — students stay protected',
                  'AI duplicate & spam detection on every review',
                  'Human moderators approve flagged content',
                  'Strict community guidelines enforced',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Link href="/login" className="btn-primary text-sm">Start Writing Reviews</Link>
                <Link href="/guidelines" className="btn-secondary text-sm">Community Guidelines</Link>
              </div>
            </div>

            {/* Right: 2x2 feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Shield,     title: 'Moderated',    desc: 'All reviews checked before publishing',   iconBg: 'bg-blue-50',   iconColor: 'text-blue-600'   },
                { icon: Users,      title: 'Anonymous',    desc: 'Student identities always protected',     iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
                { icon: TrendingUp, title: 'Always Fresh', desc: 'Synced every semester with new data',     iconBg: 'bg-green-50',  iconColor: 'text-green-600'  },
                { icon: Zap,        title: 'Instant',      desc: 'Results and schedules in under a second', iconBg: 'bg-amber-50',  iconColor: 'text-amber-600'  },
              ].map(({ icon: Icon, title, desc, iconBg, iconColor }) => (
                <div key={title} className="es-card p-5">
                  <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <p className="font-semibold text-slate-900 text-sm mb-1">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BAND ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Help your fellow students decide.
          </h2>
          <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">
            Share your experience anonymously. One review helps thousands of students pick the right courses every semester.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl text-[15px] hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <Star className="h-4 w-4" /> Write a Review
            </Link>
            <Link
              href="/schedule-builder"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-xl text-[15px] hover:bg-white/10 transition-all"
            >
              <Calendar className="h-4 w-4" /> Build a Schedule
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
