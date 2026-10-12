/**
 * S-A-02 placeholder.
 * TODO(admin slice): Better Auth (passkey + emailOTP fallback, ADR-0006), requireAdmin() in
 * every action / DAL, proxy.ts cookie check + nonce CSP, manifest + sw.js, today timeline.
 * Until then this page must not render any booking data.
 */
export default function AdminPlaceholderPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">予約管理</h1>
      <p className="mt-2 text-fg-muted">管理画面は準備中です。</p>
    </main>
  )
}
