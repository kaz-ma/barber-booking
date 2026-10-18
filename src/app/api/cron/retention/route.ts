import type { NextRequest } from 'next/server'
import { autoAdvanceBookings } from '@/features/admin/service'
import { isAuthorizedCron } from '@/features/notifications/cron-auth'
import { runRetention } from '@/features/notifications/retention'
import { guardRoute } from '@/lib/unexpected-error'

/** GET /api/cron/retention (06_api.md §4, FR-S-09 Should). 03:00 JST daily; also B2 auto statuses. */
export async function GET(request: NextRequest): Promise<Response> {
  return guardRoute('cron.retention_failed', async () => {
    // Reading the request headers makes this handler dynamic (never prerendered).
    if (!isAuthorizedCron(request.headers.get('authorization'))) {
      return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    // B2: finish the day's bookings even if the admin app was not opened.
    const statuses = await autoAdvanceBookings()
    return Response.json({ ...(await runRetention()), statuses }, { headers: { 'Cache-Control': 'no-store' } })
  })
}
