import '@/styles/globals.css'
import type { Metadata } from 'next'
import { Lato, Noto_Sans_JP } from 'next/font/google'
import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { routing } from '@/lib/i18n/routing'
import { siteUrl } from '@/lib/site'

// Self-hosted at build time by next/font (font-src 'self'). Noto is large: no preload.
const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-lato-next', display: 'swap' })
const noto = Noto_Sans_JP({ subsets: ['latin'], variable: '--font-noto-next', display: 'swap', preload: false })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { metadataBase: new URL(siteUrl()), title: t('topTitle') }
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale()
  if (!hasLocale(routing.locales, locale)) notFound()
  return (
    <html lang={locale} className={`${lato.variable} ${noto.variable}`}>
      <body className="paper min-h-dvh">
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
