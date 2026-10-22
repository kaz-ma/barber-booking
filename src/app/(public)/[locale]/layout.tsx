import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Zen_Kaku_Gothic_New } from 'next/font/google'
import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { env } from '@/lib/env'
import { routing } from '@/lib/i18n/routing'
import { siteUrl } from '@/lib/site'

// Self-hosted at build time by next/font (font-src 'self'). Inter for Latin and figures, Zen Kaku
// Gothic New for Japanese (DG-001 v0.5); Japanese glyphs stream in by unicode-range, no preload.
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Customer site is light only (DG-001 D-07): white since v0.4.
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return {
    metadataBase: new URL(siteUrl()),
    title: t('topTitle'),
    applicationName: t('siteName'),
    formatDetection: { telephone: false },
    ...(env.DEMO_MODE === '1' ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale()
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations('common')
  return (
    <html lang={locale} className={`${latin.variable} ${jp.variable}`}>
      <body className="site paper min-h-dvh">
        <a className="skip-link" href="#main">
          {t('skipToContent')}
        </a>
        {env.DEMO_MODE === '1' ? <p className="demo-banner">{t('demoBanner')}</p> : null}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
