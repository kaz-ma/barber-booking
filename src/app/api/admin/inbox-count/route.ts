import { requireAdmin } from '@/features/admin/auth'
import { getInboxCount } from '@/features/admin/queries'
import { guardRoute } from '@/lib/unexpected-error'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** GET /api/admin/inbox-count (FR-A-11): polled every 20 s while the PWA is visible. */
export async function GET(): Promise<Response> {
  return guardRoute('admin_api.inbox_count_failed', async () => {
    if (!(await requireAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
    return Response.json(await getInboxCount(), { headers: NO_STORE })
  })
}
