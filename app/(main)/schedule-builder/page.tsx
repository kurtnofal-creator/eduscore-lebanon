import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { ScheduleBuilderClient } from '@/components/schedule/ScheduleBuilderClient'
import { AdBanner } from '@/components/ads/AdBanner'
import { Zap, Info } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Schedule Builder – Build Your Perfect Class Schedule',
  description:
    'Pick your courses and automatically generate all valid conflict-free schedule combinations. Filter by best-rated professors, fewer campus days, lighter workload, and more.',
}

export default async function ScheduleBuilderPage() {
  // Get current terms
  const [terms, universities] = await Promise.all([
    prisma.academicTerm.findMany({
      where: { OR: [{ isCurrent: true }, { isActive: true }] },
      orderBy: [{ year: 'desc' }, { season: 'asc' }],
      take: 5,
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, slug: true },
      orderBy: { shortName: 'asc' },
    }),
  ])

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Schedule Builder</h1>
        <p className="text-muted-foreground max-w-2xl">
          Select the courses you want to take and we&apos;ll generate all valid conflict-free schedule combinations.
          Filter by your preferences to find the perfect schedule.
        </p>
      </div>

      {/* Beta notice */}
      <div className="flex flex-col sm:flex-row items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm">
        <div className="flex items-center gap-1.5 text-blue-700 font-semibold flex-shrink-0">
          <Zap className="h-4 w-4" /> Beta
        </div>
        <p className="text-blue-700 leading-relaxed">
          Schedule data is live and confirmed for <strong>AUB</strong> and <strong>LAU</strong> — professor names pulled directly from official university systems.
          Other universities use historical schedule patterns and are labeled accordingly.{' '}
          <span className="flex items-center gap-1 inline-flex text-blue-500 text-xs mt-0.5">
            <Info className="h-3 w-3" /> Look for the <strong>Confirmed</strong> badge on section cards.
          </span>
        </p>
      </div>

      <div className="mb-6">
        <AdBanner slot="schedule-builder-top" className="h-20" />
      </div>

      <ScheduleBuilderClient terms={terms} universities={universities} />
    </div>
  )
}
