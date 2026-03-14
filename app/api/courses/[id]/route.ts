import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }], isActive: true },
      include: {
        department: {
          include: { faculty: { include: { university: true } } },
        },
        professorCourses: {
          where: { isActive: true },
          include: {
            professor: {
              select: {
                id: true,
                fullName: true,
                slug: true,
                title: true,
                imageUrl: true,
                overallRating: true,
                teachingClarity: true,
                workloadLevel: true,
                gradingFairness: true,
                examDifficulty: true,
                recommendRate: true,
                reviewCount: true,
              },
            },
          },
        },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
          take: 15,
          select: {
            id: true,
            body: true,
            pros: true,
            cons: true,
            overallRating: true,
            workloadLevel: true,
            examDifficulty: true,
            gradingFairness: true,
            wouldRecommend: true,
            grade: true,
            termTaken: true,
            helpfulCount: true,
            createdAt: true,
            professor: {
              select: { id: true, fullName: true, slug: true },
            },
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Current term sections with all professors
    const sections = await prisma.section.findMany({
      where: { courseId: course.id, term: { isCurrent: true }, isActive: true },
      include: {
        professors: {
          include: {
            professor: {
              select: { id: true, fullName: true, slug: true, overallRating: true },
            },
          },
        },
        meetings: true,
        term: { select: { name: true, season: true, year: true } },
      },
      orderBy: { sectionNumber: 'asc' },
    })

    return NextResponse.json({ course, sections })
  } catch (error) {
    console.error('GET /api/courses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
