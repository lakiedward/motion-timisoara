export async function copyInviteValue(value: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
