import { describe, expect, it } from 'vitest'
import { isAllowedPushEndpoint } from './push-endpoint'

describe('isAllowedPushEndpoint (SR-18)', () => {
  it('accepts the browser push services', () => {
    for (const url of [
      'https://web.push.apple.com/QGh2',
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/x',
      'https://wns2-par02p.notify.windows.com/w/?token=x',
    ])
      expect(isAllowedPushEndpoint(url), url).toBe(true)
  })
  it('rejects anything else (SSRF)', () => {
    for (const url of [
      'https://127.0.0.1:9/x',
      'https://evil.example/push',
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/x',
      'https://push.apple.com.evil.example/x',
      'not a url',
    ])
      expect(isAllowedPushEndpoint(url), url).toBe(false)
  })
})
