import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/features/admin/auth'
import { getOverlaps } from '@/features/admin/queries'

const NO_STORE = { 'Cache-Control': 'no-store' }
const query = z.object({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  excludeBookingId: z.uuid().optional(),
})

/** GET /api/admin/overlaps?start&end[&excludeBookingId] (FR-A-05, 06). */
export async function GET(request: NextRequest): Promise<Response> {
  if (!(await requireAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success || Date.parse(parsed.data.end) <= Date.parse(parsed.data.start)) {
    return Response.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
  }
  const result = await getOverlaps({
    start: new Date(parsed.data.start),
    end: new Date(parsed.data.end),
    ...(parsed.data.excludeBookingId ? { excludeBookingId: parsed.data.excludeBookingId } : {}),
  })
  return Response.json(result, { headers: NO_STORE })
}
