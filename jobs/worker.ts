/**
 * EduScore Lebanon – Background Jobs Worker
 *
 * Uses BullMQ with Redis for reliable job queuing and scheduling.
 * Handles:
 *   - Scheduled data sync for all universities
 *   - Notification dispatch
 *   - Rating recomputation
 *
 * Run with: npx tsx jobs/worker.ts
 *
 * NOTE: Pass Redis connection as plain options object (not IORedis instance)
 * to avoid BullMQ's bundled ioredis version conflict.
 */

import { Queue, Worker, Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { recomputeProfessorStats, recomputeCourseStats } from '../lib/sync'
import { runSync } from '../lib/sync/engine'

const prisma = new PrismaClient()

// Use plain connection options — BullMQ uses its own bundled ioredis internally
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const parsed = new URL(redisUrl)
const connection = {
  host: parsed.hostname || 'localhost',
  port: parseInt(parsed.port || '6379'),
  password: parsed.password || undefined,
  maxRetriesPerRequest: null as null,
}

// ============================================================
// QUEUES
// ============================================================

export const syncQueue        = new Queue('university-sync',  { connection })
export const notificationQueue = new Queue('notifications',   { connection })
export const statsQueue        = new Queue('stats-recompute', { connection })

// ============================================================
// SYNC WORKER
// ============================================================

const syncWorker = new Worker(
  'university-sync',
  async (job: Job) => {
    const { universityId, syncJobId, universitySlug, termCode, type } = job.data as {
      universityId: string
      syncJobId: string
      universitySlug: string
      termCode?: string
      type?: 'FULL' | 'INCREMENTAL' | 'MANUAL'
    }

    const stats = await runSync({ jobId: syncJobId, universityId, universitySlug, termCode, type })
    return stats
  },
  { connection, concurrency: 2 },
)

// ============================================================
// STATS WORKER
// ============================================================

const statsWorker = new Worker(
  'stats-recompute',
  async (job: Job) => {
    const { type, entityId } = job.data as { type: 'professor' | 'course'; entityId: string }
    if (type === 'professor') await recomputeProfessorStats(entityId)
    else if (type === 'course') await recomputeCourseStats(entityId)
  },
  { connection, concurrency: 5 },
)

// ============================================================
// NOTIFICATION WORKER
// ============================================================

const notificationWorker = new Worker(
  'notifications',
  async (job: Job) => {
    const { type, payload } = job.data

    if (type === 'NEW_REVIEW') {
      const { professorId, courseId } = payload
      const watchers = await prisma.watchlistItem.findMany({
        where: {
          OR: [
            { professorId, type: 'PROFESSOR' },
            { courseId,    type: 'COURSE'    },
          ],
        },
        select: { userId: true, type: true, professorId: true, courseId: true },
      })

      for (const watcher of watchers) {
        await prisma.notification.create({
          data: {
            userId: watcher.userId,
            type: 'NEW_REVIEW',
            title: 'New Review',
            body: watcher.type === 'PROFESSOR'
              ? "A new review was submitted for a professor you're watching."
              : "A new review was submitted for a course you're watching.",
            link: professorId
              ? `/professors/${payload.professorSlug}`
              : `/courses/${payload.courseSlug}`,
          },
        }).catch(() => {})
      }
    }
  },
  { connection, concurrency: 10 },
)

// ============================================================
// SCHEDULED JOBS
// Normal ops: full sync weekly (Sun 2 AM), incremental daily (3 AM)
// Registration period: every 15 minutes (set REGISTRATION_PERIOD=1 env var)
// ============================================================

async function scheduleRecurringSync() {
  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, shortName: true },
  })

  const isRegistrationPeriod = process.env.REGISTRATION_PERIOD === '1'

  for (const uni of universities) {
    if (isRegistrationPeriod) {
      // Every 15 minutes during registration
      await syncQueue.add(
        `registration-sync-${uni.id}`,
        { universityId: uni.id, universitySlug: uni.slug, type: 'INCREMENTAL' },
        { repeat: { pattern: '*/15 * * * *' }, jobId: `reg-sync-${uni.id}` },
      )
    } else {
      // Weekly full sync — Sundays at 2 AM
      await syncQueue.add(
        `weekly-full-sync-${uni.id}`,
        { universityId: uni.id, universitySlug: uni.slug, type: 'FULL' },
        { repeat: { pattern: '0 2 * * 0' }, jobId: `weekly-full-${uni.id}` },
      )

      // Daily incremental — 3 AM
      await syncQueue.add(
        `daily-incremental-sync-${uni.id}`,
        { universityId: uni.id, universitySlug: uni.slug, type: 'INCREMENTAL' },
        { repeat: { pattern: '0 3 * * *' }, jobId: `daily-incr-${uni.id}` },
      )
    }
  }

  const mode = isRegistrationPeriod ? 'registration (every 15 min)' : 'normal (daily + weekly)'
  console.log(`Scheduled ${mode} sync for ${universities.length} universities`)
}

// ============================================================
// STARTUP
// ============================================================

async function main() {
  console.log('EduScore Lebanon background worker starting...')

  syncWorker.on('completed', (job) => console.log(`Sync job ${job.id} completed`))
  syncWorker.on('failed', (job, err) => console.error(`Sync job ${job?.id} failed:`, err.message))

  await scheduleRecurringSync()

  console.log('Worker ready. Queues: university-sync, notifications, stats-recompute')
}

main().catch(console.error)

process.on('SIGTERM', async () => {
  await Promise.all([syncWorker.close(), statsWorker.close(), notificationWorker.close()])
  process.exit(0)
})
