import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/features/admin/auth'
import { getFreeStarts } from '@/features/admin/queries'

const NO_STORE = { 'Cache-Control': 'no-store' }
const query = z.object({ date: z.iso.date(), menuId: z.uuid() })

/** GET /api/admin/free-starts?date&menuId — the "空き" chips of the manual booking form. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!(await requireAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
  return Response.json({ starts: await getFreeStarts(parsed.data) }, { headers: NO_STORE })
}
