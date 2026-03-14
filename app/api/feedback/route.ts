/**
 * Beta Feedback API
 * POST /api/feedback — submit feedback message (public, rate-limited)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { trackEvent } from '@/lib/analytics'

const FeedbackSchema = z.object({
  message: z.string().min(5).max(2000),
  email:   z.string().email().optional().or(z.literal('')),
  page:    z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  // 5 feedback submissions per IP per hour
  if (!rateLimit(getClientKey(req, 'feedback'), 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { message, email, page } = parsed.data

    const feedback = await prisma.feedback.create({
      data: {
        message,
        email: email || null,
        page:  page  || null,
      },
    })

    if (page) trackEvent('feedback_submitted', { page }).catch(() => {})
    else trackEvent('feedback_submitted', {}).catch(() => {})

    return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/feedback error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
