import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, string> = {}

  try {
    await auth()
    results.auth = 'OK'
  } catch (e: unknown) {
    results.auth = 'FAIL: ' + (e instanceof Error ? e.message : String(e))
  }

  try {
    const count = await prisma.professor.count()
    results.db = 'OK - ' + count + ' professors'
  } catch (e: unknown) {
    results.db = 'FAIL: ' + (e instanceof Error ? e.message : String(e))
  }

  try {
    await prisma.review.findMany({
      where: { status: 'APPROVED', professorId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      distinct: ['professorId'],
      select: { professor: { select: { id: true } } },
    })
    results.distinctQuery = 'OK'
  } catch (e: unknown) {
    results.distinctQuery = 'FAIL: ' + (e instanceof Error ? e.message : String(e))
  }

  try {
    const unis = await prisma.university.findMany({ select: { id: true, shortName: true } })
    results.universities = 'OK - ' + unis.map(u => u.shortName).join(', ')
  } catch (e: unknown) {
    results.universities = 'FAIL: ' + (e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json(results)
}
