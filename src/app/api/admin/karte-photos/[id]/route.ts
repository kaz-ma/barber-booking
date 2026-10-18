import type { NextRequest } from 'next/server'
import { isUuid } from '@/domain/uuid'
import { requireAdmin } from '@/features/admin/auth'
import { readKartePhoto } from '@/features/admin/karte'
import { guardRoute } from '@/lib/unexpected-error'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/admin/karte-photos/{id} (B3): a karte photo, admin only. Photo ids never change, so
 * the browser may keep it privately; shared caches never see it.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/karte-photos/[id]'>): Promise<Response> {
  return guardRoute('admin_api.karte_photo_failed', async () => {
    if (!(await requireAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
    const { id } = await ctx.params
    const photo = isUuid(id) ? await readKartePhoto(id) : null
    if (!photo) return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE })
    return new Response(new Uint8Array(photo.data), {
      headers: {
        'Content-Type': photo.contentType,
        'Cache-Control': 'private, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  })
}
