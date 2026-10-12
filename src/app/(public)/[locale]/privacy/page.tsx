import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { DocPage } from '../../_components/doc-page'
import { localeAlternates, openGraph } from '../../_lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('meta'), getLocale()])
  return {
    title: t('privacyTitle'),
    alternates: localeAlternates(locale, '/privacy'),
    openGraph: openGraph(locale, t('privacyTitle')),
  }
}

/** S-C-08 privacy policy (requirements §12.1; sample text pending legal review, Q-06). */
export default function PrivacyPage() {
  return <DocPage namespace="privacy" vars={{}} contactSection="contact" />
}
