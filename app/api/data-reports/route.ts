import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { trackEvent } from '@/lib/analytics'

const DataReportSchema = z.object({
  universitySlug: z.string().min(1).max(20),
  courseCode:     z.string().max(20).optional(),
  sectionId:      z.string().max(50).optional(),
  professorSlug:  z.string().max(100).optional(),
  page:           z.string().max(200).optional(),
  message:        z.string().min(5).max(1000),
})

export async function POST(req: NextRequest) {
  // 10 issue reports per minute per IP
  if (!rateLimit(getClientKey(req, 'data-reports'), 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = DataReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const report = await prisma.dataReport.create({ data: parsed.data })
    trackEvent('issue_reported', { universitySlug: parsed.data.universitySlug }).catch(() => {})
    return NextResponse.json({ ok: true, id: report.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/data-reports error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
