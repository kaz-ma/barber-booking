import { useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ui/button-link'

export default function NotFound() {
  const t = useTranslations()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('errors.notFound')}</h1>
      <ButtonLink href="/book">{t('nav.book')}</ButtonLink>
    </div>
  )
}
