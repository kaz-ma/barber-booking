import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'

/** robots.txt (01_sitemap.md §5.3). Staging / preview also send X-Robots-Tag: noindex. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
