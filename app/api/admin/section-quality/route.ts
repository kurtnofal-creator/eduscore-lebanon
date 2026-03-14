import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, shortName: true, slug: true },
    orderBy: { shortName: 'asc' },
  })

  const stats = await Promise.all(
    universities.map(async (uni) => {
      const [total, stale, complete, partial, minimal, open, closed, unknown] = await Promise.all([
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, isStale: true },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, dataQualityStatus: 'COMPLETE' },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, dataQualityStatus: 'PARTIAL' },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, dataQualityStatus: 'MINIMAL' },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, status: 'OPEN' },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, status: 'CLOSED' },
        }),
        prisma.section.count({
          where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true, status: 'UNKNOWN' },
        }),
      ])

      // Average completeness score
      const avgResult = await prisma.section.aggregate({
        where: { course: { department: { faculty: { universityId: uni.id } } }, isActive: true },
        _avg: { completenessScore: true },
      })

      return {
        universityId: uni.id,
        shortName: uni.shortName,
        total,
        stale,
        complete,
        partial,
        minimal,
        open,
        closed,
        unknown,
        avgCompleteness: Math.round((avgResult._avg.completenessScore ?? 0) * 100),
      }
    })
  )

  return NextResponse.json({ stats })
}
