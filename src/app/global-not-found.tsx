import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '404 | Neuer Barber', robots: { index: false } }

/** 404 for URLs outside every root layout (multiple root layouts, see next.config.ts). */
export default function GlobalNotFound() {
  return (
    <html lang="ja">
      <body className="paper min-h-dvh">
        <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
          <h1 className="text-2xl font-bold">ページが見つかりません</h1>
          <p lang="en">Page not found</p>
          <p>
            <a href="/ja/book" className="underline">
              予約する
            </a>{' '}
            ／{' '}
            <a href="/en/book" lang="en" className="underline">
              Book
            </a>
          </p>
        </main>
      </body>
    </html>
  )
}
