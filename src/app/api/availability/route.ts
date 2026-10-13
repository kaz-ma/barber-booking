import type { NextRequest } from 'next/server'
import { jstDate, monthOf } from '@/domain/time'
import { getMonthSlots } from '@/features/availability/queries'
import { guardRoute } from '@/lib/unexpected-error'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/availability?menu=cut&month=2026-11 (ADR-0010): one month of availability for the
 * booking section on the top page — day states plus each day's bookable start times — so the
 * calendar switches days on the client. Never cached (AGENTS.md rule 3); public data only
 * (no bookings, names or counts). Abuse is throttled by the Vercel WAF rule on this path
 * (REL-001 §7.3); the query itself is a single ~1 ms statement.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return guardRoute('availability.failed', async () => {
    const params = request.nextUrl.searchParams
    const now = new Date()
    const menu = params.get('menu') ?? ''
    const month = params.get('month') || monthOf(jstDate(now))
    const started = performance.now()
    const data = await getMonthSlots({ menuSlug: menu, month }, now)
    const dbMs = Math.round(performance.now() - started)
    const headers = { ...NO_STORE, 'Server-Timing': `db;dur=${dbMs}` }
    if (!data) return Response.json({ error: 'not_found' }, { status: 404, headers })
    return Response.json(data, { headers })
  })
}
