import type { MetadataRoute } from 'next'

/*
 * Web app manifest for the admin PWA (FR-A-15, AT-12, 06_api.md §4). Served as a route handler
 * (not app/manifest.ts) so that only the /admin layout links it: the customer site must not
 * offer installation or register a service worker. Static: prerendered at build time.
 */
const manifest: MetadataRoute.Manifest = {
  id: '/admin',
  name: '予約管理',
  short_name: '予約管理',
  description: 'Neuer Barber の予約を受けて管理する店主専用アプリ（予約・お知らせ・通知）',
  lang: 'ja',
  dir: 'ltr',
  start_url: '/admin',
  scope: '/admin',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f4ecdd',
  theme_color: '#f4ecdd',
  categories: ['business', 'productivity'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export function GET(): Response {
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
