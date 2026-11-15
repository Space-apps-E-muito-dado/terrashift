import { ApiError } from './api'
import type { T } from './i18n'

/** The message to show for a failed API call, translated when the server gave a known code. */
export function errorMessage(e: unknown, t: T): string {
  if (e instanceof ApiError && e.code === 'outside_coverage') return t('error.outsideCoverage')
  return (e as Error).message
}
