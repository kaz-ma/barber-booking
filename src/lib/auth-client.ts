'use client'

import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/react'

/**
 * Browser-side Better Auth client (same origin, /api/auth). Used for passkey sign-in and
 * registration, sign-out and the launch-time get-session call that rolls the 30-day cookie.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [passkeyClient()],
})
