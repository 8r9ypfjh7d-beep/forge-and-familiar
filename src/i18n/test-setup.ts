// Vitest setup: tests call translate('he', …) synchronously, so the Hebrew tables are registered up front.
import { he } from './locales/he'
import { registerLocale } from './translate'

registerLocale('he', he)
