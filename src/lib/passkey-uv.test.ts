import { describe, expect, it } from 'vitest'
import { assertUserVerified, passkeyUserVerificationHooks } from './passkey-uv'

describe('passkey user verification (SR-07)', () => {
  it('accepts only responses with the UV flag set', () => {
    expect(() => assertUserVerified(true)).not.toThrow()
    expect(() => assertUserVerified(false)).toThrow(/User verification/)
    expect(() => assertUserVerified(undefined)).toThrow()
  })

  it('both ceremonies use it', async () => {
    await expect(
      passkeyUserVerificationHooks.authentication.afterVerification({
        verification: { authenticationInfo: { userVerified: false } },
      }),
    ).rejects.toThrow()
    await expect(
      passkeyUserVerificationHooks.registration.afterVerification({
        verification: { registrationInfo: { userVerified: false } },
      }),
    ).rejects.toThrow()
    await expect(
      passkeyUserVerificationHooks.authentication.afterVerification({
        verification: { authenticationInfo: { userVerified: true } },
      }),
    ).resolves.toBeUndefined()
  })
})
