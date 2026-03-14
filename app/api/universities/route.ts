import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const universities = await prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, slug: true, city: true },
      orderBy: { shortName: 'asc' },
    })
    return NextResponse.json({ universities })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
