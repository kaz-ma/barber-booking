import type { Metadata } from 'next'
import { Suspense } from 'react'
import { isDateString, jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { BlockRangeForm } from '@/features/admin/components/block-range-form'

export const metadata: Metadata = { title: '時間をブロック' }

/** S-A-06 時間ブロック（期間指定）. Presets are saved directly from the S-A-02 sheet. */
export default function BlockPage({ searchParams }: PageProps<'/admin/blocks/new'>) {
  return (
    <Suspense fallback={null}>
      <Block searchParams={searchParams} />
    </Suspense>
  )
}

async function Block({ searchParams }: Pick<PageProps<'/admin/blocks/new'>, 'searchParams'>) {
  await requireAdminPage('/admin/blocks/new')
  const sp = await searchParams
  const date = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : jstDate(new Date())
  return <BlockRangeForm initialDate={date} />
}
