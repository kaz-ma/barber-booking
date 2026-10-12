import { getTranslations } from 'next-intl/server'
import { ButtonLink } from '@/components/ui/button-link'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'

/** S-C-01 stub. TODO(UI slice): hero photo, 9 info menu cards, access section per comps. */
export default async function TopPage() {
  const t = await getTranslations('home')
  const tNav = await getTranslations('nav')
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('heading')}</h1>
      <p>{t('hours')}</p>
      <p className="text-fg-muted">{t('languages')}</p>
      <ButtonLink href="/book">{t('cta')}</ButtonLink>
      <p>
        <InstagramLink label={tNav('instagram', { handle: shop.instagram.handle })} />
      </p>
    </div>
  )
}
