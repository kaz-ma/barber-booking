import type { MetadataRoute } from 'next'
import { routing } from '@/lib/i18n/routing'
import { absoluteUrl } from '@/lib/site'

/** sitemap.xml with hreflang alternates: indexable public pages only (01_sitemap.md §5.3). */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/book', '/privacy', '/policy', '/tokusho'] as const
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${path}`),
      alternates: {
        languages: Object.fromEntries([
          ...routing.locales.map((l) => [l, absoluteUrl(`/${l}${path}`)]),
          ['x-default', absoluteUrl(`/${routing.defaultLocale}${path}`)],
        ]),
      },
    })),
  )
}
