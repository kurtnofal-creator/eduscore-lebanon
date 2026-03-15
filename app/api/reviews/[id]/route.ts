import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { filterReview } from '@/lib/content-filter'
import { recomputeProfessorStats, recomputeCourseStats } from '@/lib/sync'

interface Params { params: Promise<{ id: string }> }

const EditSchema = z.object({
  body: z.string().min(20).max(2000),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(7).optional(),
  wouldRecommend: z.boolean().optional().nullable(),
  grade: z.string().optional(),
  termTaken: z.string().optional(),
  overallRating: z.number().int().min(1).max(5).optional(),
  teachingClarity: z.number().int().min(1).max(5).optional(),
  workloadLevel: z.number().int().min(1).max(5).optional(),
  gradingFairness: z.number().int().min(1).max(5).optional(),
  attendanceStrict: z.number().int().min(1).max(5).optional(),
  examDifficulty: z.number().int().min(1).max(5).optional(),
})

// PATCH /api/reviews/[id] — edit own review (re-queues for moderation)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (review.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit your own reviews' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = EditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const filterResult = filterReview(data.body)

    const updated = await prisma.review.update({
      where: { id },
      data: {
        body: filterResult.cleanedText,
        pros: data.pros ?? null,
        cons: data.cons ?? null,
        tags: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : null,
        wouldRecommend: data.wouldRecommend ?? null,
        grade: data.grade ?? null,
        termTaken: data.termTaken ?? null,
        overallRating: data.overallRating,
        teachingClarity: data.teachingClarity,
        workloadLevel: data.workloadLevel,
        gradingFairness: data.gradingFairness,
        attendanceStrict: data.attendanceStrict,
        examDifficulty: data.examDifficulty,
        // Re-queue if flagged; keep approved if clean
        status: filterResult.allowed && !filterResult.requiresModeration
          ? review.status  // keep existing status
          : 'PENDING',
      },
    })

    // Recompute stats
    if (review.professorId) await recomputeProfessorStats(review.professorId)
    if (review.courseId) await recomputeCourseStats(review.courseId)

    return NextResponse.json({ review: { id: updated.id, status: updated.status } })
  } catch (error) {
    console.error('PATCH /api/reviews/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/reviews/[id] — delete own review
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    const isOwner = review.userId === session.user.id
    const isAdmin = (session.user as { role?: string }).role === 'ADMIN' ||
                    (session.user as { role?: string }).role === 'MODERATOR'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You can only delete your own reviews' }, { status: 403 })
    }

    const { professorId, courseId } = review
    await prisma.review.delete({ where: { id } })

    if (professorId) await recomputeProfessorStats(professorId)
    if (courseId) await recomputeCourseStats(courseId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reviews/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
