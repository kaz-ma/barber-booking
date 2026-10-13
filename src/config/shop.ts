/**
 * Shop facts shown on the top / done / cancel pages, ICS LOCATION and JSON-LD
 * (OI-09 / OI-10 / OI-23 decided). No phone number by decision (OI-10): customer contact is
 * Instagram DM only. The Instagram account lives here and nowhere else (FR-C-16).
 * TODO(OI-08): English shop / stylist notation.
 */
export const shop = {
  name: 'Neuer Barber',
  stylist: { ja: '長田 健豊', en: 'Kento Osada' },
  address: {
    ja: '〒545-0052 大阪府大阪市阿倍野区阿倍野筋2丁目4-48 金村ビル3F（南B）',
    en: '3F (South B), Kanamura Bldg., 2-4-48 Abenosuji, Abeno-ku, Osaka 545-0052',
  },
  /** Two display lines (access card, done card). The access card shows the postal code above. */
  addressLines: {
    ja: ['大阪市阿倍野区阿倍野筋2丁目4-48', '金村ビル3F（南B）'],
    en: ['3F (South B), Kanamura Bldg.', '2-4-48 Abenosuji, Abeno-ku, Osaka'],
  },
  postalCode: '545-0052',
  /** schema.org PostalAddress parts (JSON-LD, ja). */
  postalAddress: {
    postalCode: '545-0052',
    streetAddress: '阿倍野筋2丁目4-48 金村ビル3F（南B）',
    addressLocality: '大阪市阿倍野区',
    addressRegion: '大阪府',
    addressCountry: 'JP',
  },
  /**
   * The building itself (GSI address search for 阿倍野筋二丁目4番48号, snapped to the OSM building
   * footprint). Map links use these coordinates: a text search for the address lands on a
   * neighbouring building.
   */
  geo: { latitude: 34.643747, longitude: 135.512554 },
  /** Walking time: route length on the OpenStreetMap network at 80 m/min, rounded up. */
  access: { station: { ja: 'JR天王寺駅', en: 'JR Tennoji Station' }, walkMinutes: 7 },
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=34.643747%2C135.512554',
  instagram: {
    handle: 'neuer.kento',
    /** Profile: "see our work" (top page). */
    url: 'https://www.instagram.com/neuer.kento/',
    /** Opens the DM thread directly: every "contact us" link (DG-001 §5.7). */
    dmUrl: 'https://ig.me/m/neuer.kento',
  },
  /**
   * Hero photo (U-01). `null` renders the warm CSS placeholder; once the client's photo
   * arrives, put it under public/brand/ and set e.g. { src: '/brand/hero.jpg', width, height }.
   */
  heroPhoto: null as { src: string; width: number; height: number } | null,
  emblem: { src: '/brand/neuer-emblem.png', width: 187, height: 144 },
} as const

/**
 * Version and effective date of the privacy policy / cancellation policy / 特商法 pages
 * (12.1, 12.3). The pages render these values and consents.policy_version stores the string
 * built from them, so a stored consent always points at the text that was shown (SR-13).
 * Bump both when the policy text changes.
 */
export const POLICY = { version: '1.0', effectiveDate: '2026-11-01' } as const

/** Stored in consents.policy_version, e.g. "1.0 (2026-11-01)" (<= 32 chars, CHECK). */
export const POLICY_VERSION = `${POLICY.version} (${POLICY.effectiveDate})`
