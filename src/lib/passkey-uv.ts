import { APIError } from 'better-auth/api'

/*
 * Passkey user verification (SR-07, NFR-SC-01). `authenticatorSelection.userVerification:
 * 'required'` is only a hint to the browser; Better Auth passkey 1.7.7 verifies both ceremonies
 * with requireUserVerification: false. These hooks reject a response whose UV flag is not set
 * (e.g. a security key without a PIN that was merely touched).
 */

export function assertUserVerified(userVerified: boolean | undefined): void {
  if (userVerified !== true) {
    throw new APIError('UNAUTHORIZED', { message: 'User verification (biometrics / PIN) is required' })
  }
}

export const passkeyUserVerificationHooks = {
  registration: {
    afterVerification: async ({
      verification,
    }: {
      verification: { registrationInfo?: { userVerified?: boolean } }
    }) => {
      assertUserVerified(verification.registrationInfo?.userVerified)
      return undefined
    },
  },
  authentication: {
    afterVerification: async ({
      verification,
    }: {
      verification: { authenticationInfo?: { userVerified?: boolean } }
    }) => {
      assertUserVerified(verification.authenticationInfo?.userVerified)
    },
  },
}
