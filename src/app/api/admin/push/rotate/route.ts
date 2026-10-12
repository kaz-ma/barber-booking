import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { isAllowedPushEndpoint } from '@/domain/push-endpoint'
import { requireAdmin } from '@/features/admin/auth'
import { rotatePushSubscription } from '@/features/admin/service'
import { siteUrl } from '@/lib/site'
import { guardRoute } from '@/lib/unexpected-error'

const NO_STORE = { 'Cache-Control': 'no-store' }
const body = z.object({
  oldEndpoint: z.url().max(2048).optional(),
  subscription: z.object({
    endpoint: z
      .url({ protocol: /^https$/ })
      .max(2048)
      .refine(isAllowedPushEndpoint),
    keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(64) }),
  }),
})

/**
 * POST /api/admin/push/rotate (06_api.md §4, AT-20): called by public/sw.js on
 * `pushsubscriptionchange` (Android). Cookie session + same-origin check (T-08).
 */
export async function POST(request: NextRequest): Promise<Response> {
  return guardRoute('admin_api.push_rotate_failed', async () => {
    // Browsers (incl. the service worker's fetch) always send Origin on POST: require it (SR-17).
    const origin = request.headers.get('origin')
    if (origin !== new URL(siteUrl()).origin) return new Response(null, { status: 403, headers: NO_STORE })
    const session = await requireAdmin()
    if (!session) return new Response(null, { status: 401, headers: NO_STORE })
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return new Response(null, { status: 400, headers: NO_STORE })
    await rotatePushSubscription(parsed.data, {
      userId: session.user.id,
      sessionId: session.session.id,
      userAgent: request.headers.get('user-agent'),
    })
    return new Response(null, { status: 204, headers: NO_STORE })
  })
}
