import '@/styles/globals.css'
import '@/styles/admin.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Zen_Kaku_Gothic_New } from 'next/font/google'
import { headers } from 'next/headers'
import { siteUrl } from '@/lib/site'

// Self-hosted at build time by next/font (font-src 'self'). Japanese font is large: no preload.
const latin = Inter({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-latin-next',
  display: 'swap',
})
const jp = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-jp-next',
  display: 'swap',
  preload: false,
})

/*
 * Admin PWA root layout (U-07): Japanese only, outside next-intl. Rendered per request
 * (`instant = false` + headers()): no static shell, so Next.js stamps the CSP nonce from
 * proxy.ts on every script (08_security.md §8.3). The manifest is linked here only — the
 * customer site never offers installation.
 */
export const instant = false

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: '予約管理', template: '%s｜予約管理' },
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  applicationName: '予約管理',
  appleWebApp: { capable: true, title: '予約管理', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4ecdd' },
    { media: '(prefers-color-scheme: dark)', color: '#191919' },
  ],
}

export default async function AdminRootLayout({ children }: LayoutProps<'/admin'>) {
  // Request-time read: the whole admin tree renders per request so the CSP nonce applies.
  await headers()
  return (
    <html lang="ja" className={`admin-html ${latin.variable} ${jp.variable}`}>
      <body className="admin paper">{children}</body>
    </html>
  )
}
