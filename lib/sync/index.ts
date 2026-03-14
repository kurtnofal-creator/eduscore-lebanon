/**
 * EduScore Lebanon – Academic Data Sync System
 *
 * Coordinates automated ingestion of professor/course/section data
 * from university sources. Because live APIs are rarely available,
 * this system uses a combination of:
 *   1. Structured scrapers per university
 *   2. Manual admin corrections
 *   3. Scheduled background jobs
 */

import { prisma } from '@/lib/db'
import { SyncType, SyncStatus, LogLevel } from '@/lib/constants'

export interface SyncResult {
  added: number
  updated: number
  skipped: number
  errors: number
}

export interface SyncContext {
  jobId: string
  universityId: string
  log: (level: LogLevel, message: string, data?: unknown) => Promise<void>
}

// Create a new sync job record
export async function createSyncJob(universityId: string, type: SyncType) {
  return prisma.syncJob.create({
    data: { universityId, type, status: SyncStatus.PENDING },
  })
}

// Mark a job as started
export async function startSyncJob(jobId: string) {
  return prisma.syncJob.update({
    where: { id: jobId },
    data: { status: SyncStatus.RUNNING, startedAt: new Date() },
  })
}

// Mark a job as completed
export async function completeSyncJob(jobId: string, stats: SyncResult) {
  return prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: SyncStatus.COMPLETED,
      completedAt: new Date(),
      stats: JSON.stringify(stats),
    },
  })
}

// Mark a job as failed (with optional retry scheduling)
export async function failSyncJob(jobId: string, error: string, retry = false) {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } })
  const retryCount = (job?.retryCount ?? 0) + 1
  const maxRetries = 3

  return prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: retry && retryCount <= maxRetries ? SyncStatus.RETRYING : SyncStatus.FAILED,
      errorMessage: error,
      retryCount,
      nextRetryAt: retry && retryCount <= maxRetries
        ? new Date(Date.now() + retryCount * 5 * 60 * 1000) // exponential back-off
        : null,
    },
  })
}

// Structured context logger
export function createSyncContext(jobId: string, universityId: string): SyncContext {
  return {
    jobId,
    universityId,
    async log(level: LogLevel, message: string, data?: unknown) {
      await prisma.syncLog.create({
        data: {
          jobId,
          level,
          message,
          data: data ? JSON.stringify(data) : undefined,
        },
      }).catch(() => {})
    },
  }
}

/**
 * Upsert a professor record into the database.
 * Handles duplicate detection by matching on fullName + departmentId.
 */
export async function upsertProfessor(
  ctx: SyncContext,
  data: {
    firstName: string
    lastName: string
    departmentId: string
    title?: string
    email?: string
  }
): Promise<{ id: string; isNew: boolean }> {
  const fullName = `${data.title ? data.title + ' ' : ''}${data.firstName} ${data.lastName}`.trim()
  const baseSlug = `${data.firstName.toLowerCase().replace(/\s+/g, '-')}-${data.lastName.toLowerCase().replace(/\s+/g, '-')}`

  // Find existing by fullName + department
  const existing = await prisma.professor.findFirst({
    where: {
      firstName: { equals: data.firstName },
      lastName: { equals: data.lastName },
      departmentId: data.departmentId,
    },
  })

  if (existing) {
    await prisma.professor.update({
      where: { id: existing.id },
      data: { lastSyncedAt: new Date(), ...data, fullName },
    })
    return { id: existing.id, isNew: false }
  }

  // Generate unique slug
  let slug = baseSlug
  let counter = 0
  while (await prisma.professor.findUnique({ where: { slug } })) {
    counter++
    slug = `${baseSlug}-${counter}`
  }

  const created = await prisma.professor.create({
    data: { ...data, fullName, slug, lastSyncedAt: new Date() },
  })

  await ctx.log(LogLevel.INFO, `New professor created: ${fullName}`, { id: created.id })
  return { id: created.id, isNew: true }
}

/**
 * Upsert a course record.
 */
export async function upsertCourse(
  ctx: SyncContext,
  data: {
    code: string
    name: string
    departmentId: string
    credits?: number
    description?: string
  }
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.course.findFirst({
    where: {
      code: { equals: data.code },
      departmentId: data.departmentId,
    },
  })

  const slug = `${data.code.replace(/\s+/g, '-').toLowerCase()}`

  if (existing) {
    await prisma.course.update({
      where: { id: existing.id },
      data: { name: data.name, credits: data.credits, updatedAt: new Date() },
    })
    return { id: existing.id, isNew: false }
  }

  const created = await prisma.course.create({
    data: { ...data, slug },
  })

  await ctx.log(LogLevel.INFO, `New course created: ${data.code}`, { id: created.id })
  return { id: created.id, isNew: true }
}

/**
 * Upsert a section for a given course + term.
 */
export async function upsertSection(
  ctx: SyncContext,
  data: {
    courseId: string
    termId: string
    sectionNumber: string
    crn?: string
    location?: string
    capacity?: number
    enrolled?: number
    seatsRemaining?: number
    status?: string
    sourceConnector?: string
    sourceIdentifier?: string
    historicalInference?: boolean
    completenessScore?: number
    dataQualityStatus?: string
    professors: string[]  // professorIds
    professorConfidence?: string  // CONFIRMED | INFERRED
    meetings: Array<{
      day: string
      startTime: string
      endTime: string
      type?: string
      location?: string
    }>
  }
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.section.findFirst({
    where: {
      courseId: data.courseId,
      termId: data.termId,
      sectionNumber: data.sectionNumber,
    },
  })

  const qualityFields = {
    enrolled: data.enrolled,
    seatsRemaining: data.seatsRemaining,
    status: data.status ?? 'UNKNOWN',
    sourceConnector: data.sourceConnector,
    sourceIdentifier: data.sourceIdentifier,
    historicalInference: data.historicalInference ?? false,
    completenessScore: data.completenessScore ?? 0,
    dataQualityStatus: data.dataQualityStatus ?? 'MINIMAL',
    isStale: false,
    lastSyncedAt: new Date(),
  }

  if (existing) {
    // Update section and refresh meeting times
    await prisma.section.update({
      where: { id: existing.id },
      data: {
        crn: data.crn,
        location: data.location,
        capacity: data.capacity,
        ...qualityFields,
      },
    })

    // Refresh meeting times
    await prisma.sectionMeeting.deleteMany({ where: { sectionId: existing.id } })
    await prisma.sectionMeeting.createMany({
      data: data.meetings.map(m => ({
        sectionId: existing.id,
        day: m.day as never,
        startTime: m.startTime,
        endTime: m.endTime,
        type: (m.type ?? 'LECTURE') as never,
        location: m.location,
      })),
    })

    // Refresh professor assignments
    await prisma.sectionProfessor.deleteMany({ where: { sectionId: existing.id } })
    for (const profId of data.professors) {
      await prisma.sectionProfessor.create({
        data: { sectionId: existing.id, professorId: profId, isPrimary: data.professors.indexOf(profId) === 0, confidence: data.professorConfidence ?? 'INFERRED' },
      })
      // Also link professor to course
      await prisma.professorCourse.upsert({
        where: { professorId_courseId: { professorId: profId, courseId: data.courseId } },
        update: {},
        create: { professorId: profId, courseId: data.courseId },
      })
    }

    return { id: existing.id, isNew: false }
  }

  // Create new section
  const section = await prisma.section.create({
    data: {
      courseId: data.courseId,
      termId: data.termId,
      sectionNumber: data.sectionNumber,
      crn: data.crn,
      location: data.location,
      capacity: data.capacity,
      ...qualityFields,
    },
  })

  await prisma.sectionMeeting.createMany({
    data: data.meetings.map(m => ({
      sectionId: section.id,
      day: m.day as never,
      startTime: m.startTime,
      endTime: m.endTime,
      type: (m.type ?? 'LECTURE') as never,
      location: m.location,
    })),
  })

  for (const profId of data.professors) {
    await prisma.sectionProfessor.create({
      data: { sectionId: section.id, professorId: profId, isPrimary: data.professors.indexOf(profId) === 0, confidence: data.professorConfidence ?? 'INFERRED' },
    })
    await prisma.professorCourse.upsert({
      where: { professorId_courseId: { professorId: profId, courseId: data.courseId } },
      update: {},
      create: { professorId: profId, courseId: data.courseId },
    })
  }

  await ctx.log(LogLevel.INFO, `New section created: §${data.sectionNumber}`, { id: section.id })
  return { id: section.id, isNew: true }
}

/**
 * Recompute aggregated professor ratings from all approved reviews.
 * Called after any review is approved/rejected.
 */
export async function recomputeProfessorStats(professorId: string): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { professorId, status: 'APPROVED' },
    select: {
      overallRating: true,
      teachingClarity: true,
      workloadLevel: true,
      gradingFairness: true,
      attendanceStrict: true,
      examDifficulty: true,
      participation: true,
      wouldRecommend: true,
    },
  })

  if (reviews.length === 0) {
    await prisma.professor.update({
      where: { id: professorId },
      data: {
        overallRating: null,
        teachingClarity: null,
        workloadLevel: null,
        gradingFairness: null,
        attendanceStrict: null,
        examDifficulty: null,
        participation: null,
        recommendRate: null,
        reviewCount: 0,
      },
    })
    return
  }

  const avg = (key: keyof typeof reviews[0]) => {
    const vals = reviews.map(r => r[key]).filter((v): v is number => typeof v === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const recommends = reviews.filter(r => r.wouldRecommend === true).length
  const recommendRate = recommends / reviews.length

  await prisma.professor.update({
    where: { id: professorId },
    data: {
      overallRating: avg('overallRating'),
      teachingClarity: avg('teachingClarity'),
      workloadLevel: avg('workloadLevel'),
      gradingFairness: avg('gradingFairness'),
      attendanceStrict: avg('attendanceStrict'),
      examDifficulty: avg('examDifficulty'),
      participation: avg('participation'),
      recommendRate: recommendRate * 100,
      reviewCount: reviews.length,
    },
  })
}

/**
 * Recompute aggregated course stats from all approved reviews.
 */
export async function recomputeCourseStats(courseId: string): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { courseId, status: 'APPROVED' },
    select: { workloadLevel: true, examDifficulty: true, gradingFairness: true },
  })

  if (reviews.length === 0) {
    await prisma.course.update({
      where: { id: courseId },
      data: { avgWorkload: null, avgDifficulty: null, avgGrading: null, reviewCount: 0 },
    })
    return
  }

  const avg = (key: keyof typeof reviews[0]) => {
    const vals = reviews.map(r => r[key]).filter((v): v is number => typeof v === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      avgWorkload: avg('workloadLevel'),
      avgDifficulty: avg('examDifficulty'),
      avgGrading: avg('gradingFairness'),
      reviewCount: reviews.length,
    },
  })
}
