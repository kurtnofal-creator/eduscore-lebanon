import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { paginate } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const perPage = Math.min(50, parseInt(searchParams.get('perPage') ?? '20'))
    const departmentId = searchParams.get('departmentId')
    const universityId = searchParams.get('universityId')
    const search = searchParams.get('q')
    const sort = searchParams.get('sort') ?? 'rating'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true,
      isMerged: false,
    }

    if (departmentId) where.departmentId = departmentId
    if (universityId) {
      where.department = { faculty: { universityId } }
    }
    if (search) {
      where.fullName = { contains: search }
    }

    const orderBy =
      sort === 'rating'
        ? { overallRating: 'desc' as const }
        : sort === 'reviews'
        ? { reviewCount: 'desc' as const }
        : { fullName: 'asc' as const }

    const [professors, total] = await Promise.all([
      prisma.professor.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          slug: true,
          title: true,
          imageUrl: true,
          overallRating: true,
          workloadLevel: true,
          reviewCount: true,
          recommendRate: true,
          department: {
            select: {
              name: true,
              slug: true,
              faculty: {
                select: {
                  university: { select: { shortName: true, slug: true } },
                },
              },
            },
          },
        },
      }),
      prisma.professor.count({ where }),
    ])

    return NextResponse.json({ professors, pagination: paginate(total, page, perPage) })
  } catch (error) {
    console.error('GET /api/professors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
