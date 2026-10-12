import 'server-only'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

/*
 * Delivery of the admin login code (emailOTP fallback, OI-12 / OI-21, 08_security.md §4).
 * Resend's HTTP API is called directly (one request, no SDK dependency). Without
 * RESEND_API_KEY the code is printed to the server log in development only, with a warning;
 * in production / preview a missing key is an error (the code is never logged there).
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = '予約管理 <onboarding@resend.dev>'

/** Test-only sink so the OTP flow can be exercised offline (never populated in production). */
export const devOtpOutbox: { email: string; otp: string; at: Date }[] = []

/** The code is in the body only: a subject shows on lock-screen notification previews (SR-09). */
export const OTP_EMAIL_SUBJECT = '予約管理のログインコード'

export function buildAdminOtpEmail(
  email: string,
  otp: string,
): { from: string; to: string[]; subject: string; text: string } {
  return {
    from: env.RESEND_FROM ?? DEFAULT_FROM,
    to: [email],
    subject: OTP_EMAIL_SUBJECT,
    text: [
      `予約管理のログインコード: ${otp}`,
      '',
      'ホーム画面の「予約管理」アプリに戻って、この 6 桁を入力してください（10 分間有効）。',
      'このメールに心当たりがない場合は破棄してください。',
    ].join('\n'),
  }
}

export async function sendAdminOtpEmail(email: string, otp: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === 'test') {
      devOtpOutbox.push({ email, otp, at: new Date() })
      return
    }
    if (env.NODE_ENV === 'development' && !env.VERCEL_ENV) {
      // Deliberately printed so local login works without an email provider.
      console.warn(
        `\n[admin-login] RESEND_API_KEY is not set — DEVELOPMENT ONLY login code: ${otp} (valid 10 minutes)\n`,
      )
      return
    }
    logger.error('admin_otp.delivery_unconfigured', { reason: 'RESEND_API_KEY unset' })
    return
  }

  const body = buildAdminOtpEmail(email, otp)
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) logger.error('admin_otp.delivery_failed', { httpStatus: res.status })
  } catch (err) {
    logger.error('admin_otp.delivery_failed', { errorName: err instanceof Error ? err.name : 'unknown' })
  }
}
