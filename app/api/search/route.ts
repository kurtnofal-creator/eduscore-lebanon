import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { trackEvent } from '@/lib/analytics'
import { rateLimit, getClientKey } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  // 60 requests per minute per IP
  if (!rateLimit(getClientKey(req, 'search'), 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q')?.trim() ?? ''
    const type = searchParams.get('type') ?? 'all' // 'professors' | 'courses' | 'universities' | 'all'
    const universityId = searchParams.get('universityId')
    const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '8'))

    if (q.length < 2) {
      return NextResponse.json({ professors: [], courses: [], universities: [] })
    }

    // Track search event asynchronously
    trackEvent('search', { query: q, type }).catch(() => {})

    const [professors, courses, universities] = await Promise.all([
      // Professor search
      type === 'courses' ? [] : prisma.professor.findMany({
        where: {
          isActive: true,
          isMerged: false,
          fullName: { contains: q, mode: 'insensitive' },
          ...(universityId && { department: { faculty: { universityId } } }),
        },
        select: {
          id: true,
          fullName: true,
          slug: true,
          title: true,
          overallRating: true,
          reviewCount: true,
          department: {
            select: {
              name: true,
              faculty: {
                select: { university: { select: { shortName: true, slug: true } } },
              },
            },
          },
        },
        orderBy: { reviewCount: 'desc' },
        take: limit,
      }),

      // Course search
      type === 'professors' ? [] : prisma.course.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
          ...(universityId && { department: { faculty: { universityId } } }),
        },
        select: {
          id: true,
          code: true,
          name: true,
          slug: true,
          credits: true,
          avgDifficulty: true,
          reviewCount: true,
          department: {
            select: {
              name: true,
              faculty: {
                select: { university: { select: { shortName: true, slug: true } } },
              },
            },
          },
        },
        orderBy: { reviewCount: 'desc' },
        take: limit,
      }),

      // University search (only when 'all' or 'universities')
      type !== 'all' && type !== 'universities' ? [] : prisma.university.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { shortName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, shortName: true, slug: true, city: true },
        take: 5,
      }),
    ])

    return NextResponse.json({ professors, courses, universities })
  } catch (error) {
    console.error('GET /api/search error:', error)
    trackEvent('error', { type: 'search', message: String(error) }).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
