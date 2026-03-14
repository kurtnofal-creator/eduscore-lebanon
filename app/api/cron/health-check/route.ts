/**
 * Daily Health Check — cron endpoint
 *
 * POST /api/cron/health-check
 *
 * Checks AUB and LAU section counts, CRN coverage, confirmed professor rate,
 * and stale data. Records a warning AnalyticsEvent for each metric that drops
 * below threshold, so the admin monitoring dashboard can surface issues.
 *
 * Secured by CRON_SECRET header. Call from Vercel Cron / cron job once per day.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDBIntegrity } from '@/lib/sync/dbIntegrity'
import { trackEvent } from '@/lib/analytics'
import { prisma } from '@/lib/db'

const UNIVERSITY_SLUGS = ['aub', 'lau']

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (bearer && process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return true
  // Legacy: x-cron-secret header
  const legacy = req.headers.get('x-cron-secret')
  if (legacy && process.env.CRON_SECRET && legacy === process.env.CRON_SECRET) return true
  return false
}

// GET — called by Vercel Cron
export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const results: Record<string, unknown>[] = []

  for (const slug of UNIVERSITY_SLUGS) {
    const university = await prisma.university.findUnique({
      where: { slug },
      select: { id: true, shortName: true },
    })
    if (!university) continue

    // Find the current active term for this university
    const term = await prisma.academicTerm.findFirst({
      where: { OR: [{ universityId: university.id }, { universityId: null }], isCurrent: true },
      orderBy: { year: 'desc' },
    })
    if (!term) continue

    const integrity = await checkDBIntegrity(university.id, term.id)

    results.push({ university: slug, ...integrity })

    // Log a warning event for each critical
    for (const critical of integrity.criticals) {
      await trackEvent('health_check_critical', {
        university: slug,
        message: critical,
        healthScore: integrity.healthScore,
      })
    }

    // Log a warning event for each warning
    for (const warning of integrity.warnings) {
      await trackEvent('health_check_warning', {
        university: slug,
        message: warning,
        healthScore: integrity.healthScore,
      })
    }

    // Record overall health check result
    await trackEvent('health_check_complete', {
      university: slug,
      healthScore: integrity.healthScore,
      passed: integrity.passed,
      totalSections: integrity.totalSections,
      crnCoverageRate: integrity.crnCoverageRate,
      confirmedRate: integrity.confirmedRate,
      staleSections: integrity.staleSections,
    })
  }

  return NextResponse.json({ ok: true, checked: UNIVERSITY_SLUGS, results })
}
