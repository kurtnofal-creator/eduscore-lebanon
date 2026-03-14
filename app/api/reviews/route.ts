import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { filterReview, isDuplicateReview, hashIp } from '@/lib/content-filter'
import { recomputeProfessorStats, recomputeCourseStats } from '@/lib/sync'
import { ReviewStatus } from '@/lib/constants'
import { trackEvent } from '@/lib/analytics'

const ReviewSchema = z.object({
  professorId: z.string().optional(),
  courseId: z.string().optional(),
  termTaken: z.string().optional(),
  overallRating: z.number().int().min(1).max(5).optional(),
  teachingClarity: z.number().int().min(1).max(5).optional(),
  workloadLevel: z.number().int().min(1).max(5).optional(),
  gradingFairness: z.number().int().min(1).max(5).optional(),
  attendanceStrict: z.number().int().min(1).max(5).optional(),
  examDifficulty: z.number().int().min(1).max(5).optional(),
  participation: z.number().int().min(1).max(5).optional(),
  wouldRecommend: z.boolean().optional(),
  grade: z.string().optional(),
  body: z.string().min(20).max(2000),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(7).optional(),
}).refine(d => d.professorId || d.courseId, {
  message: 'Review must target a professor or course',
})

// Rate limit: max 5 reviews per user per day
async function checkReviewRateLimit(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const count = await prisma.review.count({
    where: { userId, createdAt: { gte: since } },
  })
  return count < 5
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check user is not banned
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isBanned: true },
    })
    if (user?.isBanned) {
      return NextResponse.json({ error: 'Your account has been suspended' }, { status: 403 })
    }

    // Rate limiting
    const withinLimit = await checkReviewRateLimit(session.user.id)
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'You have reached the daily review limit. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = ReviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid review data', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Check for duplicate review (same user + same professor/course)
    const existing = await prisma.review.findFirst({
      where: {
        userId: session.user.id,
        professorId: data.professorId,
        courseId: data.courseId,
      },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'You have already submitted a review for this professor/course.' },
        { status: 409 }
      )
    }

    // Get recent reviews for duplicate text detection
    const recentReviews = await prisma.review.findMany({
      where: {
        professorId: data.professorId ?? undefined,
        courseId: data.courseId ?? undefined,
        status: ReviewStatus.APPROVED,
      },
      select: { body: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    if (isDuplicateReview(data.body, recentReviews.map(r => r.body))) {
      return NextResponse.json(
        { error: 'This review appears too similar to an existing review.' },
        { status: 409 }
      )
    }

    // Content filtering
    const filterResult = filterReview(data.body)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? ''
    const ipHash = await hashIp(ip)

    let status: ReviewStatus = ReviewStatus.APPROVED

    if (!filterResult.allowed) {
      status = ReviewStatus.REJECTED
    } else if (filterResult.requiresModeration) {
      status = ReviewStatus.PENDING
    }

    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        professorId: data.professorId,
        courseId: data.courseId,
        termTaken: data.termTaken,
        isAnonymous: true,
        status,
        overallRating: data.overallRating,
        teachingClarity: data.teachingClarity,
        workloadLevel: data.workloadLevel,
        gradingFairness: data.gradingFairness,
        attendanceStrict: data.attendanceStrict,
        examDifficulty: data.examDifficulty,
        participation: data.participation,
        wouldRecommend: data.wouldRecommend,
        grade: data.grade,
        body: filterResult.cleanedText,
        pros: data.pros,
        cons: data.cons,
        tags: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : undefined,
        ipHash,
      },
    })

    // If review needs moderation, add to queue
    if (status === ReviewStatus.PENDING && filterResult.flags.length > 0) {
      await prisma.moderationQueue.create({
        data: {
          reviewId: review.id,
          reason: 'Automated content flags',
          autoFlags: JSON.stringify(filterResult.flags),
        },
      })
    }

    // Update aggregated stats if auto-approved
    if (status === ReviewStatus.APPROVED) {
      if (data.professorId) await recomputeProfessorStats(data.professorId)
      if (data.courseId) await recomputeCourseStats(data.courseId)
    }

    const message =
      status === ReviewStatus.APPROVED
        ? 'Review submitted successfully!'
        : status === ReviewStatus.PENDING
        ? 'Review submitted and is pending moderation. It will appear once approved.'
        : 'Review could not be published due to policy violations.'

    trackEvent('review_submitted', {
      status,
      professorId: data.professorId ?? null,
      courseId: data.courseId ?? null,
    }).catch(() => {})

    return NextResponse.json({ review: { id: review.id, status }, message }, { status: 201 })
  } catch (error) {
    console.error('POST /api/reviews error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const professorId = searchParams.get('professorId')
    const courseId = searchParams.get('courseId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const perPage = 10

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: ReviewStatus.APPROVED,
    }
    if (professorId) where.professorId = professorId
    if (courseId) where.courseId = courseId

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          body: true,
          pros: true,
          cons: true,
          overallRating: true,
          teachingClarity: true,
          workloadLevel: true,
          gradingFairness: true,
          attendanceStrict: true,
          examDifficulty: true,
          participation: true,
          wouldRecommend: true,
          grade: true,
          termTaken: true,
          tags: true,
          helpfulCount: true,
          createdAt: true,
          professor: { select: { id: true, fullName: true, slug: true } },
          course: { select: { id: true, code: true, name: true, slug: true } },
        },
      }),
      prisma.review.count({ where }),
    ])

    return NextResponse.json({
      reviews,
      pagination: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('GET /api/reviews error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
