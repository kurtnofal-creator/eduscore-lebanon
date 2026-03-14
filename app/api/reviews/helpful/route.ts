import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId } = await req.json()

  const existing = await prisma.reviewVote.findUnique({
    where: { reviewId_userId: { reviewId, userId: session.user.id } },
  })

  if (existing) return NextResponse.json({ error: 'Already voted' }, { status: 409 })

  await prisma.$transaction([
    prisma.reviewVote.create({
      data: { reviewId, userId: session.user.id, isHelpful: true },
    }),
    prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    }),
  ])

  return NextResponse.json({ ok: true })
}
