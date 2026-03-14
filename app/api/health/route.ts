/**
 * Public health check endpoint
 * GET /api/health  (also reachable via GET /health — see vercel.json rewrite)
 *
 * No authentication required. Used by uptime monitors (e.g. UptimeRobot, BetterStack).
 * Returns HTTP 200 as long as the Next.js runtime is responsive.
 * Does NOT query the database — keeps latency low and avoids false positives
 * caused by DB connection pool exhaustion.
 */

import { NextResponse } from 'next/server'

export const runtime = 'edge'   // respond from the edge — fastest possible latency
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString() },
    { status: 200 },
  )
}
