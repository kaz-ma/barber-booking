import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { policyDateLabel } from '@/lib/i18n/policy-date'
import { POLICY, POLICY_VERSION } from './shop'

/* SR-13: the stored consent version and the displayed version / date come from one place. */

describe('policy version (SR-13)', () => {
  it('consents.policy_version is derived from the displayed version and effective date', () => {
    expect(POLICY_VERSION).toBe(`${POLICY.version} (${POLICY.effectiveDate})`)
    expect(POLICY_VERSION.length).toBeLessThanOrEqual(32)
    expect(POLICY.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('the pages format the same date per locale', () => {
    const [y, m, d] = POLICY.effectiveDate.split('-').map(Number)
    expect(policyDateLabel('ja')).toBe(`${y}年${m}月${d}日`)
    expect(policyDateLabel('en')).toContain(String(y))
  })

  it('messages carry no separate version / date that could drift', () => {
    for (const locale of ['ja', 'en']) {
      const messages = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'))
      for (const ns of ['privacy', 'policy', 'tokusho']) {
        expect(messages[ns].version).toBeUndefined()
        expect(messages[ns].date).toBeUndefined()
      }
    }
  })
})
