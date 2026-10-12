import type messages from '../../../messages/ja.json'
import type { formatsFor } from './formats'
import type { routing } from './routing'

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: typeof messages
    Formats: ReturnType<typeof formatsFor>
  }
}
