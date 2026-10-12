/**
 * Cache tags for cached reference data (DES-00 §3.2, FR-S-12, AT-22). The only place tag names
 * are spelled: readers call cacheTag(CACHE_TAGS.x), admin actions call updateTag(CACHE_TAGS.x),
 * so a reader and its invalidation can never drift apart again (CR-03). Availability is never
 * cached and has no tag.
 */
export const CACHE_TAGS = {
  /** Menu catalog / active menus (top page, /book). */
  menus: 'menus',
  /** Public settings (lead time, cancel deadline, max advance days). */
  settings: 'settings',
  /** Weekly business hours (top page access block, JSON-LD, cancel page) and overrides. */
  businessHours: 'business-hours',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]
