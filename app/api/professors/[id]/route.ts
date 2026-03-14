import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Support lookup by slug or id
    const professor = await prisma.professor.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        isActive: true,
      },
      include: {
        department: {
          include: {
            faculty: {
              include: { university: true },
            },
          },
        },
        professorCourses: {
          where: { isActive: true },
          include: {
            course: {
              select: {
                id: true,
                code: true,
                name: true,
                slug: true,
                credits: true,
                avgWorkload: true,
                avgDifficulty: true,
                reviewCount: true,
              },
            },
          },
          take: 20,
        },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
          take: 10,
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
            wouldRecommend: true,
            grade: true,
            termTaken: true,
            helpfulCount: true,
            createdAt: true,
          },
        },
      },
    })

    if (!professor) {
      return NextResponse.json({ error: 'Professor not found' }, { status: 404 })
    }

    // Get sections for current terms
    const sections = await prisma.section.findMany({
      where: {
        professors: { some: { professorId: professor.id } },
        term: { isCurrent: true },
        isActive: true,
      },
      include: {
        course: { select: { code: true, name: true } },
        meetings: true,
        term: { select: { name: true } },
      },
      take: 20,
    })

    return NextResponse.json({ professor, sections })
  } catch (error) {
    console.error('GET /api/professors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
