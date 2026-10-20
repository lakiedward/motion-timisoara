export const SHARED_LOCATION_GUARD_HINT = 'shared_location_guard'

export function locationWriteErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'hint' in error &&
    error.hint === SHARED_LOCATION_GUARD_HINT &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message
  }
  return fallback
}
