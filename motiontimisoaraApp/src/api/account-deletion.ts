import { supabase } from '@/lib/supabase'
import { clearPushBeforeSignOut } from './notifications'

export type AccountDeletionMode = 'deleted' | 'anonymized'

export const ACCOUNT_DELETION_ERROR =
  'Nu am putut șterge contul. Verifică conexiunea și încearcă din nou.'
export const ACCOUNT_DELETION_PARENT_ONLY =
  'Contul de club sau de antrenor se șterge la cerere. Scrie-ne din pagina de contact.'

export class AccountDeletionError extends Error {}

async function removeChildPhotos(userId: string) {
  const bucket = supabase.storage.from('child-photos')
  const { data } = await bucket.list(userId, { limit: 1000 })
  const paths = (data ?? []).filter((f) => f.id !== null).map((f) => `${userId}/${f.name}`)
  if (paths.length) await bucket.remove(paths)
}

export async function deleteMyAccount(userId: string): Promise<AccountDeletionMode> {
  await clearPushBeforeSignOut().catch(() => undefined)
  const { data, error } = await supabase.rpc('delete_my_account')
  if (error) {
    throw new AccountDeletionError(
      error.hint === 'account_deletion_parent_only'
        ? ACCOUNT_DELETION_PARENT_ONLY
        : ACCOUNT_DELETION_ERROR,
    )
  }
  await removeChildPhotos(userId).catch(() => undefined)
  await supabase.auth.signOut({ scope: 'local' })
  const mode = (data as { mode?: string } | null)?.mode
  return mode === 'anonymized' ? 'anonymized' : 'deleted'
}
