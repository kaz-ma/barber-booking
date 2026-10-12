/**
 * CSP violation report parsing (SR-11). Pure: turns either report format into PII-free summaries.
 * URLs are reduced to their origin (paths can carry cancel tokens); keywords such as `inline`
 * or `eval` are kept as-is.
 */
export type CspViolationSummary = { directive: string; blocked: string; disposition: string }

const MAX_REPORTS = 10

function blockedOrigin(value: unknown): string {
  if (typeof value !== 'string' || value === '') return 'unknown'
  if (/^[a-z-]{1,20}$/i.test(value)) return value.toLowerCase() // inline, eval, self, data, blob…
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : u.protocol.replace(/:$/, '')
  } catch {
    return 'invalid'
  }
}

const token = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^[a-z0-9-]{1,40}$/i.test(value) ? value.toLowerCase() : fallback

function summarize(r: Record<string, unknown>): CspViolationSummary {
  const directive = r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'] ?? r.violatedDirective
  return {
    directive: token(typeof directive === 'string' ? directive.split(' ')[0] : directive, 'unknown'),
    blocked: blockedOrigin(r['blocked-uri'] ?? r.blockedURL),
    disposition: token(r.disposition, 'unknown'),
  }
}

export function summarizeCspReports(body: unknown): CspViolationSummary[] {
  // report-uri: { "csp-report": { ... } }
  if (body && typeof body === 'object' && !Array.isArray(body) && 'csp-report' in body) {
    const r = (body as Record<string, unknown>)['csp-report']
    return r && typeof r === 'object' ? [summarize(r as Record<string, unknown>)] : []
  }
  // report-to: [{ type: 'csp-violation', body: { ... } }, ...]
  if (Array.isArray(body)) {
    return body
      .filter((e): e is { type: string; body: Record<string, unknown> } => {
        return !!e && typeof e === 'object' && e.type === 'csp-violation' && !!e.body && typeof e.body === 'object'
      })
      .slice(0, MAX_REPORTS)
      .map((e) => summarize(e.body))
  }
  return []
}
