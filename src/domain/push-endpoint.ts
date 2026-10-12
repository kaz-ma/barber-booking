/**
 * Push endpoints the server will POST to (SR-18): the browser push services only, so a
 * subscription can never make the server call an arbitrary / internal host.
 * Apple (Safari / iOS PWA), Google FCM (Chrome, Android, Samsung), Mozilla, Microsoft (Edge).
 */
const PUSH_HOSTS = [
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/,
]

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && url.port === '' && PUSH_HOSTS.some((re) => re.test(url.hostname))
  } catch {
    return false
  }
}
