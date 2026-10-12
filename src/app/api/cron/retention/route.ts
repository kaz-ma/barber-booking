import type { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/features/notifications/cron-auth'
import { runRetention } from '@/features/notifications/retention'

/** GET /api/cron/retention (06_api.md §4, FR-S-09 Should). 03:00 JST daily. */
export async function GET(request: NextRequest): Promise<Response> {
  // Reading the request headers makes this handler dynamic (never prerendered).
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json(await runRetention(), { headers: { 'Cache-Control': 'no-store' } })
}
