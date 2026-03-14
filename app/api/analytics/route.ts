import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDashboardStats } from '@/lib/analytics'
import { trackEvent } from '@/lib/analytics'

// POST /api/analytics – track a client-side event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, ...properties } = body

    if (typeof event !== 'string' || !event) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const referrer = req.headers.get('referer') ?? undefined
    await trackEvent(event, { ...properties, referrer })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/analytics – admin stats
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const days = parseInt(searchParams.get('days') ?? '30')

  const stats = await getDashboardStats(days)
  return NextResponse.json(stats)
}
