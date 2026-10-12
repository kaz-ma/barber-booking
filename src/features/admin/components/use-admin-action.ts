'use client'

import type { ActionResult } from '@/lib/action-result'
import { errorText, firstFieldError, S } from '../strings'
import { hardNavigate } from './client-hooks'

/**
 * Shared handling of admin action results on the client: `unauthorized` sends the owner to the
 * login screen (session expired / revoked from another device), other non-ok results become a
 * Japanese message. Returns the message to show, or null when the result is ok.
 */
export function describeFailure(result: ActionResult<unknown> | { status: string }): string | null {
  switch (result.status) {
    case 'ok':
      return null
    case 'unauthorized':
      hardNavigate(`/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return S.errors.unauthorized as string
    case 'invalid':
      return firstFieldError((result as { fieldErrors: Record<string, string[]> }).fieldErrors)
    case 'not_found':
      return S.errors.not_found as string
    case 'rate_limited':
      return S.errors.rate_limited as string
    case 'conflict': {
      const reason = (result as { reason?: string }).reason
      return reason === 'undo_blocked' ? S.detail.undoBlocked : S.manual.overlapTitle
    }
    case 'error':
      return (S.errors.error as (d: string) => string)((result as { digest: string }).digest)
    default:
      return errorText(result.status)
  }
}
