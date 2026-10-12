import { redirect } from 'next/navigation'

/** /admin/settings -> the first settings screen. */
export default function SettingsIndex() {
  redirect('/admin/settings/hours')
}
