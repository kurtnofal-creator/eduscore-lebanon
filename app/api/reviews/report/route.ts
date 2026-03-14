import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ReportReason } from '@/lib/constants'

const ReportSchema = z.object({
  reviewId: z.string(),
  reason: z.nativeEnum(ReportReason).default(ReportReason.OTHER),
  details: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { reviewId, reason, details } = parsed.data

  const existing = await prisma.report.findFirst({
    where: { reviewId, userId: session.user.id },
  })
  if (existing) return NextResponse.json({ error: 'Already reported' }, { status: 409 })

  await prisma.$transaction([
    prisma.report.create({
      data: { reviewId, userId: session.user.id, reason, details },
    }),
    prisma.review.update({
      where: { id: reviewId },
      data: { flagCount: { increment: 1 }, status: { set: 'FLAGGED' } },
    }),
  ])

  return NextResponse.json({ ok: true })
}
