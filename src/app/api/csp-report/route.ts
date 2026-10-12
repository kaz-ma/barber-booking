import type { NextRequest } from 'next/server'
import { clientIp } from '@/lib/client-ip'
import { summarizeCspReports } from '@/lib/csp-report'
import { logger } from '@/lib/logger'
import { hitWindow, LIMITS, rateKeys } from '@/lib/rate-limit'
import { guardRoute } from '@/lib/unexpected-error'

const NO_CONTENT = { status: 204, headers: { 'Cache-Control': 'no-store' } }
const MAX_BODY_BYTES = 16 * 1024

/**
 * POST /api/csp-report (SR-11, AT-26): receives `report-uri` (application/csp-report) and
 * `report-to` (application/reports+json) violation reports. Rate-limited per IP (hashed) and
 * logged without URLs, IPs or sample code: only the directive, the blocked origin / keyword and
 * the disposition, so token-bearing page URLs never reach the logs. Always answers 204.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return guardRoute('csp_report.failed', async () => {
    const { windowSec, limit } = LIMITS.cspReportIp
    const rate = await hitWindow(rateKeys.cspReportIp(clientIp(request.headers)), windowSec, limit)
    if (!rate.ok) return new Response(null, NO_CONTENT)
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return new Response(null, NO_CONTENT)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return new Response(null, NO_CONTENT)
    }
    for (const v of summarizeCspReports(body)) logger.warn('csp.violation', v)
    return new Response(null, NO_CONTENT)
  })
}
