import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Lato, Noto_Sans_JP } from 'next/font/google'
import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/lib/i18n/routing'
import { siteUrl } from '@/lib/site'

// Self-hosted at build time by next/font (font-src 'self'). Only the latin subset of Noto Sans JP
// is preloaded; Japanese glyphs stream in by unicode-range (DG-001 §3).
const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-lato-next', display: 'swap' })
const noto = Noto_Sans_JP({ subsets: ['latin'], variable: '--font-noto-next', display: 'swap' })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Customer site is light only (DG-001 D-07): --paper-98.
  themeColor: '#f4ecdd',
  colorScheme: 'light',
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return {
    metadataBase: new URL(siteUrl()),
    title: t('topTitle'),
    applicationName: t('siteName'),
    formatDetection: { telephone: false },
  }
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale()
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations('common')
  return (
    <html lang={locale} className={`${lato.variable} ${noto.variable}`}>
      <body className="paper min-h-dvh">
        <a className="skip-link" href="#main">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
