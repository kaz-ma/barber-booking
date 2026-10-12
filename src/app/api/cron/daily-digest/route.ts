import type { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/features/notifications/cron-auth'
import { runDailyDigest } from '@/features/notifications/digest'

/** GET /api/cron/daily-digest (06_api.md §4, FR-A-12). Vercel Cron sends the bearer token. */
export async function GET(request: NextRequest): Promise<Response> {
  // Reading the request headers makes this handler dynamic (never prerendered).
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const result = await runDailyDigest()
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
