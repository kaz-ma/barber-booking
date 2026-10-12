/**
 * Shop facts shown on the done page, ICS LOCATION and JSON-LD (OI-09 / OI-10 / OI-23 decided).
 * No phone number by decision (OI-10): customer contact is Instagram DM only.
 * TODO(OI-08): English shop / stylist notation.
 */
export const shop = {
  name: 'Neuer Barber',
  stylist: { ja: '長田 健豊', en: 'Kento Osada' },
  address: {
    ja: '大阪市阿倍野区阿倍野筋2-4-48 金村ビル3階南（B）',
    en: '3F South (B), Kanamura Bldg., 2-4-48 Abenosuji, Abeno-ku, Osaka',
  },
  mapUrl:
    'https://maps.google.com/?q=%E5%A4%A7%E9%98%AA%E5%B8%82%E9%98%BF%E5%80%8D%E9%87%8E%E5%8C%BA%E9%98%BF%E5%80%8D%E9%87%8E%E7%AD%8B2-4-48',
  instagram: { handle: 'neuer.kento', url: 'https://www.instagram.com/neuer.kento/' },
} as const

/** Version string stored in consents.policy_version. Bump when the policy text changes. */
export const POLICY_VERSION = '2026-10-12'
