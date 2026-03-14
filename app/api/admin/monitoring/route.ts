import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { HEALTH_THRESHOLDS } from '@/lib/sync/healthCheck'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      shortName: true,
      name: true,
      faculties: {
        select: {
          departments: {
            select: {
              _count: { select: { professors: { where: { isActive: true, isMerged: false } } } },
            },
          },
        },
      },
      syncJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          type: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          stats: true,
          createdAt: true,
        },
      },
    },
    orderBy: { shortName: 'asc' },
  })

  const rows = await Promise.all(universities.map(async (uni) => {
    const lastJob = uni.syncJobs[0] ?? null

    // Section counts
    const [totalSections, staleSections, currentTermSections] = await Promise.all([
      prisma.section.count({
        where: { isActive: true, course: { department: { faculty: { universityId: uni.id } } } },
      }),
      prisma.section.count({
        where: { isStale: true, course: { department: { faculty: { universityId: uni.id } } } },
      }),
      prisma.academicTerm.findFirst({
        where: { universityId: uni.id, isCurrent: true },
        orderBy: { year: 'desc' },
      }).then(term =>
        term
          ? prisma.section.count({ where: { termId: term.id, isActive: true } })
          : 0
      ),
    ])

    const professorCount = uni.faculties
      .flatMap(f => f.departments)
      .reduce((sum, d) => sum + d._count.professors, 0)

    // Health status
    const thresholds = HEALTH_THRESHOLDS[uni.slug]
    let healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN'
    if (thresholds) {
      if (totalSections >= thresholds.minSections && professorCount >= thresholds.minProfessors) {
        healthStatus = staleSections === 0 ? 'HEALTHY' : 'DEGRADED'
      } else if (totalSections < thresholds.minSections) {
        healthStatus = 'CRITICAL'
      } else {
        healthStatus = 'DEGRADED'
      }
    }

    // Recent critical sync logs
    const recentCriticals = lastJob
      ? await prisma.syncLog.count({
          where: { jobId: lastJob.id, level: 'ERROR', message: { contains: '[HEALTH CRITICAL]' } },
        })
      : 0

    if (recentCriticals > 0) healthStatus = 'CRITICAL'

    return {
      id: uni.id,
      slug: uni.slug,
      shortName: uni.shortName,
      name: uni.name,
      totalSections,
      currentTermSections,
      staleSections,
      professorCount,
      healthStatus,
      lastJob: lastJob
        ? {
            status: lastJob.status,
            type: lastJob.type,
            completedAt: lastJob.completedAt?.toISOString() ?? null,
            startedAt: lastJob.startedAt?.toISOString() ?? null,
            createdAt: lastJob.createdAt.toISOString(),
            errorMessage: lastJob.errorMessage,
            stats: lastJob.stats ? JSON.parse(lastJob.stats) : null,
          }
        : null,
    }
  }))

  // Open data reports count
  const openReports = await prisma.dataReport.count({ where: { status: 'OPEN' } })

  // Recent error events (last 24h)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentErrors = await prisma.analyticsEvent.count({
    where: { event: 'error', createdAt: { gte: since24h } },
  })

  return NextResponse.json({ universities: rows, openReports, recentErrors })
}
