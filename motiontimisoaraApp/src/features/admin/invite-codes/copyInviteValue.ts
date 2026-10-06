import { toast } from 'sonner'

export async function copyInviteValue(value: string, successMessage: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(value)
    toast.success(successMessage)
    return true
  } catch {
    toast.error('Nu am putut copia. Valoarea rămâne disponibilă pentru copiere manuală.')
    return false
  }
}
