import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAdminSession } from '@/features/admin/auth'
import { LoginPanel } from '@/features/admin/components/login-panel'
import { safeAdminNext } from '@/features/admin/schema'

export const metadata: Metadata = { title: 'ログイン' }

/** S-A-01 ログイン (FR-A-01). Already signed in -> straight to `next`. */
export default function LoginPage({ searchParams }: PageProps<'/admin/login'>) {
  return (
    <Suspense fallback={null}>
      <Login searchParams={searchParams} />
    </Suspense>
  )
}

async function Login({ searchParams }: Pick<PageProps<'/admin/login'>, 'searchParams'>) {
  const sp = await searchParams
  const next = safeAdminNext(typeof sp.next === 'string' ? sp.next : undefined)
  if (await getAdminSession()) redirect(next as '/admin')
  return <LoginPanel next={next} />
}
