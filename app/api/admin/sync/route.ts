import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSyncJob } from '@/lib/sync'
import { runSync } from '@/lib/sync/engine'
import { SyncType } from '@/lib/constants'

async function requireAdmin(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return null
  if (session.user.role !== 'ADMIN') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const universityId = searchParams.get('universityId')

  const [jobs, recentLogs] = await Promise.all([
    prisma.syncJob.findMany({
      where: universityId ? { universityId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        university: { select: { shortName: true, name: true, slug: true } },
      },
    }),
    prisma.syncLog.findMany({
      where: { level: { in: ['ERROR', 'WARN'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return NextResponse.json({ jobs, recentLogs })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({
    universityId: z.string(),
    type: z.nativeEnum(SyncType).default(SyncType.MANUAL),
    termCode: z.string().optional(),
  }).safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const university = await prisma.university.findUnique({
    where: { id: parsed.data.universityId },
    select: { id: true, slug: true, shortName: true },
  })
  if (!university) return NextResponse.json({ error: 'University not found' }, { status: 404 })

  const job = await createSyncJob(parsed.data.universityId, parsed.data.type)

  await prisma.adminAction.create({
    data: {
      adminId: session.user.id,
      action: 'TRIGGER_SYNC',
      entityType: 'University',
      entityId: parsed.data.universityId,
      metadata: JSON.stringify({ jobId: job.id, type: parsed.data.type }),
    },
  })

  // Run sync inline (non-blocking — fire and forget for the response)
  runSync({
    jobId: job.id,
    universityId: university.id,
    universitySlug: university.slug,
    termCode: parsed.data.termCode,
    type: parsed.data.type as 'FULL' | 'INCREMENTAL' | 'MANUAL',
  }).catch(() => {})

  return NextResponse.json({
    job,
    message: `Sync started for ${university.shortName}`,
  }, { status: 201 })
}
