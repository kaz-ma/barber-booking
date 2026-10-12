import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '予約管理',
  robots: { index: false, follow: false },
}

/** Admin PWA root layout: Japanese only, outside next-intl routing (U-07). */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  )
}
