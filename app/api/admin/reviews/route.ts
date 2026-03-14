import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { recomputeProfessorStats, recomputeCourseStats } from '@/lib/sync'
import { ReviewStatus } from '@/lib/constants'

async function requireAdmin(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return null
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') return null
  return session
}

const ModerationActionSchema = z.object({
  reviewId: z.string(),
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
})

// GET /api/admin/reviews – list reviews pending moderation
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const status = (searchParams.get('status') ?? 'PENDING') as ReviewStatus
  const page = parseInt(searchParams.get('page') ?? '1')
  const perPage = 20

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        professor: { select: { fullName: true, slug: true } },
        course: { select: { code: true, name: true } },
        moderationQueue: true,
        reports: { select: { reason: true, details: true }, take: 5 },
      },
    }),
    prisma.review.count({ where: { status } }),
  ])

  return NextResponse.json({
    reviews,
    pagination: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
  })
}

// POST /api/admin/reviews – approve or reject a review
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const parsed = ModerationActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { reviewId, action, note } = parsed.data
  const newStatus = action === 'APPROVE' ? ReviewStatus.APPROVED : ReviewStatus.REJECTED

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { professorId: true, courseId: true },
  })

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { status: newStatus, moderationNote: note },
    }),
    prisma.moderationQueue.upsert({
      where: { reviewId },
      update: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        moderatorId: session.user.id,
        decision: note,
        decidedAt: new Date(),
      },
      create: {
        reviewId,
        reason: 'Manual moderation',
        autoFlags: '[]',
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        moderatorId: session.user.id,
        decision: note,
        decidedAt: new Date(),
      },
    }),
    prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        action: action === 'APPROVE' ? 'APPROVE_REVIEW' : 'REJECT_REVIEW',
        entityType: 'Review',
        entityId: reviewId,
        metadata: note ? JSON.stringify({ note }) : undefined,
      },
    }),
  ])

  // Recompute stats after moderation
  if (review.professorId) await recomputeProfessorStats(review.professorId)
  if (review.courseId) await recomputeCourseStats(review.courseId)

  return NextResponse.json({ success: true, status: newStatus })
}
