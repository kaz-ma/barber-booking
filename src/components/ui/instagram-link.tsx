import { shop } from '@/config/shop'

/** The only customer contact channel (OI-10 / OI-23): no phone number or tel: links. */
export function InstagramLink({ label }: { label: string }) {
  return (
    <a
      href={shop.instagram.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center underline underline-offset-4"
    >
      {label}
    </a>
  )
}
