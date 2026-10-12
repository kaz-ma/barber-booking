import '@/styles/globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: '404 | Neuer Barber', robots: { index: false } }

/**
 * 404 for URLs outside every root layout (multiple root layouts, see next.config.ts). Bilingual
 * because no locale is known here; /{locale}/… paths use the localized not-found page instead.
 */
export default function GlobalNotFound() {
  return (
    <html lang="ja">
      <body className="paper min-h-dvh">
        <main className="wrap">
          <div className="nf">
            <p className="code404" aria-hidden="true">
              <b>404</b>
              <span lang="en">NOT FOUND</span>
            </p>
            <h1 className="title-24">ページが見つかりません</h1>
            <p className="desc" lang="en">
              Page not found
            </p>
          </div>
          <div className="nf-actions">
            <Link href="/ja/book" className="btn btn-primary btn-block">
              予約する
            </Link>
            <Link href="/en/book" lang="en" className="btn btn-secondary btn-block">
              Book
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
