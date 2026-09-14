export const RECOVERY_LIFETIME_MS = 10 * 60 * 1000

type RecoverySession = {
  access_token: string
  expires_at?: number
  user: { id: string }
}

export function createRecoveryGrant(now = () => Date.now()) {
  let grant: { token: string; userId: string; expiresAt: number } | null = null
  return {
    issue(session: RecoverySession) {
      grant = {
        token: session.access_token,
        userId: session.user.id,
        expiresAt: Math.min(now() + RECOVERY_LIFETIME_MS, (session.expires_at ?? 0) * 1000),
      }
    },
    valid(session: RecoverySession | null) {
      return !!(
        grant &&
        session &&
        now() < grant.expiresAt &&
        session.access_token === grant.token &&
        session.user.id === grant.userId
      )
    },
    clear() {
      grant = null
    },
  }
}

export const webRecoveryGrant = createRecoveryGrant()
