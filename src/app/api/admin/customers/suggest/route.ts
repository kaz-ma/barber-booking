import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/features/admin/auth'
import { suggestCustomers } from '@/features/admin/queries'
import { guardRoute } from '@/lib/unexpected-error'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** GET /api/admin/customers/suggest?q= (phone exact, kana partial, max 8; FR-A-05). */
export async function GET(request: NextRequest): Promise<Response> {
  return guardRoute('admin_api.suggest_failed', async () => {
    if (!(await requireAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
    const q = request.nextUrl.searchParams.get('q') ?? ''
    if (q.trim().length < 2 || q.length > 50)
      return Response.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
    return Response.json({ items: await suggestCustomers(q) }, { headers: NO_STORE })
  })
}
