import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sectionIds, termId, name } = await req.json()

  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    return NextResponse.json({ error: 'No sections provided' }, { status: 400 })
  }

  const saved = await prisma.savedSchedule.create({
    data: {
      userId: session.user.id,
      name: name ?? `Schedule ${new Date().toLocaleDateString()}`,
      termId,
      sections: {
        create: sectionIds.map((id: string) => ({ sectionId: id })),
      },
    },
  })

  return NextResponse.json({ schedule: saved }, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schedules = await prisma.savedSchedule.findMany({
    where: { userId: session.user.id },
    include: {
      sections: {
        include: {
          section: {
            include: {
              course: { select: { code: true, name: true } },
              professors: { include: { professor: { select: { fullName: true } } } },
              meetings: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ schedules })
}
