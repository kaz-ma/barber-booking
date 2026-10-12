import type { Metadata } from 'next'
import { InstallGuide } from '@/features/admin/components/install-guide'

export const metadata: Metadata = { title: 'ホーム画面に追加' }

/** S-A-12 インストール案内 (reachable without a session). */
export default function InstallPage() {
  return <InstallGuide />
}
