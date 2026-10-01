import { Preferences } from '@capacitor/preferences'
import { isNative } from '@/lib/platform'

const DRAFT_KEY = 'motion-coach-invitation-draft'
export const COACH_DRAFT_LIFETIME_MS = 10 * 60 * 1000

export async function clearCoachInvitationDraft(): Promise<void> {
  if (isNative()) await Preferences.remove({ key: DRAFT_KEY })
  else window.sessionStorage.removeItem(DRAFT_KEY)
}

export async function saveCoachInvitationDraft(invitationCode: string): Promise<void> {
  const code = invitationCode.trim()
  if (code.length < 5 || code.length > 128) throw new Error('Invalid invitation draft')
  const value = JSON.stringify({ invitationCode: code, createdAt: Date.now() })
  if (isNative()) await Preferences.set({ key: DRAFT_KEY, value })
  else window.sessionStorage.setItem(DRAFT_KEY, value)
}

export async function readCoachInvitationDraft(): Promise<string | null> {
  const value = isNative()
    ? (await Preferences.get({ key: DRAFT_KEY })).value
    : window.sessionStorage.getItem(DRAFT_KEY)
  if (!value) return null
  try {
    const draft: unknown = JSON.parse(value)
    if (typeof draft !== 'object' || !draft) throw new Error('Invalid invitation draft')
    const { invitationCode, createdAt } = draft as Record<string, unknown>
    if (
      typeof invitationCode !== 'string' ||
      invitationCode.length < 5 ||
      invitationCode.length > 128 ||
      typeof createdAt !== 'number' ||
      !Number.isFinite(createdAt) ||
      createdAt > Date.now() ||
      Date.now() - createdAt >= COACH_DRAFT_LIFETIME_MS
    )
      throw new Error('Expired invitation draft')
    return invitationCode
  } catch {
    await clearCoachInvitationDraft()
    return null
  }
}
