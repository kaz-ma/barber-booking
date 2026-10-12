import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { shop } from '@/config/shop'

/**
 * Hero (S-C-01): photo only, no copy on top (F1). Until the client's photo arrives (U-01) the
 * framed slot shows the warm CSS placeholder; then `shop.heroPhoto` switches it to next/image
 * with priority (LCP element).
 */
export function Hero() {
  const t = useTranslations('home')
  const photo = shop.heroPhoto
  if (photo) {
    return (
      <figure className="photo">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={t('photoRealAlt')}
          priority
          sizes="(min-width: 1024px) 1008px, 100vw"
        />
      </figure>
    )
  }
  return (
    <figure className="photo photo-placeholder" role="img" aria-label={t('photoAlt')}>
      <figcaption aria-hidden="true">
        {t('photoCaption')}
        <span>{t('photoCaptionText')}</span>
      </figcaption>
    </figure>
  )
}
