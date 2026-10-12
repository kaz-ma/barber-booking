import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { getPublicSettings } from '@/features/settings/queries'
import { DocPage } from '../../_components/doc-page'
import { localeAlternates, openGraph } from '../../_lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('meta'), getLocale()])
  return {
    title: t('policyTitle'),
    alternates: localeAlternates(locale, '/policy'),
    openGraph: openGraph(locale, t('policyTitle')),
  }
}

/** S-C-09 cancellation policy (requirements §12.2 draft; the deadline comes from settings). */
export default async function PolicyPage() {
  const settings = await getPublicSettings()
  return <DocPage namespace="policy" vars={{ hours: settings.cancelDeadlineMin / 60 }} contactSection="cancel" />
}
