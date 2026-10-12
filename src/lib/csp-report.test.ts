import { describe, expect, it } from 'vitest'
import { summarizeCspReports } from './csp-report'

const TOKEN = 'A'.repeat(43)

describe('summarizeCspReports (SR-11)', () => {
  it('report-uri format: directive, blocked origin only, no document URL / sample', () => {
    const out = summarizeCspReports({
      'csp-report': {
        'document-uri': `https://shop.example/ja/cancel/${TOKEN}`,
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src-elem',
        'blocked-uri': `https://evil.example/x.js?t=${TOKEN}`,
        'script-sample': 'alert(1)',
        disposition: 'report',
      },
    })
    expect(out).toEqual([{ directive: 'script-src-elem', blocked: 'https://evil.example', disposition: 'report' }])
    expect(JSON.stringify(out)).not.toContain(TOKEN)
  })

  it('report-to format, keywords kept, non-CSP entries ignored, capped', () => {
    const entry = (blockedURL: string) => ({
      type: 'csp-violation',
      url: `https://shop.example/ja/book/done/${TOKEN}`,
      body: { effectiveDirective: 'script-src', blockedURL, disposition: 'enforce' },
    })
    const out = summarizeCspReports([entry('inline'), { type: 'deprecation', body: {} }, entry('eval')])
    expect(out).toEqual([
      { directive: 'script-src', blocked: 'inline', disposition: 'enforce' },
      { directive: 'script-src', blocked: 'eval', disposition: 'enforce' },
    ])
    expect(summarizeCspReports(Array.from({ length: 50 }, () => entry('inline')))).toHaveLength(10)
  })

  it('garbage yields nothing', () => {
    expect(summarizeCspReports(null)).toEqual([])
    expect(summarizeCspReports('x')).toEqual([])
    expect(summarizeCspReports({ 'csp-report': 3 })).toEqual([])
  })
})
