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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true,
    }

    if (departmentId) where.departmentId = departmentId
    if (universityId) {
      where.department = { faculty: { universityId } }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { reviewCount: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          code: true,
          name: true,
          slug: true,
          credits: true,
          avgWorkload: true,
          avgDifficulty: true,
          avgGrading: true,
          reviewCount: true,
          department: {
            select: {
              name: true,
              code: true,
              faculty: {
                select: {
                  university: { select: { shortName: true, slug: true } },
                },
              },
            },
          },
          _count: { select: { professorCourses: true } },
        },
      }),
      prisma.course.count({ where }),
    ])

    return NextResponse.json({ courses, pagination: paginate(total, page, perPage) })
  } catch (error) {
    console.error('GET /api/courses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
