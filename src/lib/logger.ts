/**
 * Structured logger with PII redaction (08_security.md §9, NFR-SC-07).
 * Never log names, kana, phone numbers, notes, raw tokens / token URLs or raw IPs.
 *
 * Redaction is by key, case-insensitive and recursive (nested objects / arrays), so a field
 * accidentally passed inside `{ input: {...} }` is still masked. Values embedded in free text
 * (e.g. an exception message that carries SQL parameters) cannot be detected here: unexpected
 * errors must be logged through `errorFields()` (src/lib/pg-errors.ts), never `err.message`.
 */
const REDACT_KEYS = new Set(
  [
    'name',
    'nameKana',
    'name_kana',
    'phone',
    'phoneE164',
    'phone_e164',
    'phoneDisplay',
    'note',
    'ownerNote',
    'token',
    'rawToken',
    'cancelUrl',
    'confirmUrl',
    'doneUrl',
    'url',
    'ip',
    'userAgent',
    'user_agent',
    'turnstileToken',
    'email',
    'otp',
    'code',
    'endpoint',
    'authorization',
    'cookie',
    'secret',
    'message',
    'stack',
    'query',
    'params',
    'detail',
  ].map((k) => k.toLowerCase()),
)

type Fields = Record<string, unknown>

const MAX_DEPTH = 4

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return '[truncated]'
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1))
  // Never serialise Error objects (their message may carry SQL parameters).
  if (value instanceof Error) return `[${value.name}]`
  const out: Fields = {}
  for (const [k, v] of Object.entries(value as Fields)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : redactValue(v, depth + 1)
  }
  return out
}

export function redact(fields: Fields): Fields {
  return redactValue(fields, 0) as Fields
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
