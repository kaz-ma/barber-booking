/**
 * Structured logger with PII redaction (08_security.md §9, NFR-SC-07).
 * Never log names, kana, phone numbers, notes, raw tokens / token URLs or raw IPs.
 */
const REDACT_KEYS = new Set([
  'name',
  'nameKana',
  'phone',
  'phoneE164',
  'note',
  'token',
  'cancelUrl',
  'doneUrl',
  'ip',
  'userAgent',
  'turnstileToken',
])

type Fields = Record<string, unknown>

function redact(fields: Fields): Fields {
  const out: Fields = {}
  for (const [k, v] of Object.entries(fields)) out[k] = REDACT_KEYS.has(k) ? '[redacted]' : v
  return out
}

function write(level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, event, ...redact(fields) })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export const logger = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields),
}
