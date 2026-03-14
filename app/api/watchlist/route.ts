import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { professorId, courseId } = await req.json()
  const type = professorId ? 'PROFESSOR' : 'COURSE'

  await prisma.watchlistItem.upsert({
    where: {
      userId_type_professorId_courseId: {
        userId: session.user.id,
        type,
        professorId: professorId ?? null,
        courseId: courseId ?? null,
      },
    },
    update: {},
    create: { userId: session.user.id, type, professorId, courseId },
  })

  return NextResponse.json({ watched: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { professorId, courseId } = await req.json()
  const type = professorId ? 'PROFESSOR' : 'COURSE'

  await prisma.watchlistItem.deleteMany({
    where: {
      userId: session.user.id,
      type,
      professorId: professorId ?? null,
      courseId: courseId ?? null,
    },
  })

  return NextResponse.json({ watched: false })
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ items: [] })

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      professor: { select: { id: true, fullName: true, slug: true } },
      course: { select: { id: true, code: true, name: true, slug: true } },
    },
  })

  return NextResponse.json({ items })
}
