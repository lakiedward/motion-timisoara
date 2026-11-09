import * as React from 'react'
import { App } from '@capacitor/app'
import { toast } from 'sonner'
import { isNative } from '@/lib/platform'
import { supabase } from '@/lib/supabase'
import {
  confirmAccountActive,
  loadAppUserResult,
  PROFILE_LOAD_ERROR,
  signOutDisabledAccount,
  type AppUser,
  type LoadAppUserResult,
} from '@/api/auth'
import { ACCOUNT_DISABLED_MESSAGE, onAccountDisabled } from '@/lib/auth/account-disabled'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  profileError: string | null
  refresh: () => Promise<AppUser | null>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [needsRecovery, setNeedsRecovery] = React.useState(false)
  const verifiedUser = React.useRef<AppUser | null>(null)
  const sessionUserId = React.useRef<string | null | undefined>(undefined)
  const requestVersion = React.useRef({ value: 0 })
  const mounted = React.useRef(false)

  const applyResult = React.useCallback(async (): Promise<AppUser | null> => {
    if (!mounted.current) return null
    const version = ++requestVersion.current.value
    const result = await loadAppUserResult().catch(
      (): LoadAppUserResult => ({
        status: 'error' as const,
        message: PROFILE_LOAD_ERROR,
      }),
    )
    if (!mounted.current || version !== requestVersion.current.value) return null
    const resultUserId =
      result.status === 'ok'
        ? result.user.id
        : result.status === 'error'
          ? result.sessionUserId
          : null
    if (
      resultUserId &&
      sessionUserId.current !== undefined &&
      resultUserId !== sessionUserId.current
    ) {
      verifiedUser.current = null
      setUser(null)
      setProfileError(PROFILE_LOAD_ERROR)
      setNeedsRecovery(true)
      setLoading(false)
      return null
    }
    if (resultUserId) sessionUserId.current = resultUserId
    if (result.status === 'ok') {
      verifiedUser.current = result.user
      setUser(result.user)
      setProfileError(null)
      setNeedsRecovery(false)
    } else if (result.status === 'signed_out') {
      verifiedUser.current = null
      sessionUserId.current = null
      setUser(null)
      setProfileError(null)
      setNeedsRecovery(false)
    } else {
      const keepVerifiedUser =
        isNative() &&
        result.retryable === true &&
        result.sessionUserId !== undefined &&
        verifiedUser.current?.id === result.sessionUserId &&
        sessionUserId.current === result.sessionUserId
      if (keepVerifiedUser) {
        setUser(verifiedUser.current)
        setProfileError(null)
      } else {
        verifiedUser.current = null
        setUser(null)
        setProfileError(result.message)
      }
      setNeedsRecovery(true)
    }
    setLoading(false)
    return result.status === 'ok' ? result.user : null
  }, [])

  React.useEffect(() => {
    if (!needsRecovery) return
    const retry = () => {
      void applyResult()
    }
    window.addEventListener('online', retry)
    const listener = isNative()
      ? App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) retry()
        })
      : null
    return () => {
      window.removeEventListener('online', retry)
      void listener?.then((handle) => handle.remove())
    }
  }, [needsRecovery, applyResult])

  React.useEffect(() => {
    let ending = false
    return onAccountDisabled(() => {
      if (ending) return
      ending = true
      toast.error(ACCOUNT_DISABLED_MESSAGE, { id: 'account-disabled', duration: 15_000 })
      void signOutDisabledAccount()
        .catch(() => undefined)
        .finally(() => {
          ending = false
        })
    })
  }, [])

  React.useEffect(() => {
    if (!user) return
    const check = () => {
      if (document.visibilityState === 'visible') void confirmAccountActive().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [user])

  React.useEffect(() => {
    mounted.current = true
    const requests = requestVersion.current
    void Promise.resolve().then(applyResult)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = event === 'SIGNED_OUT' ? null : (session?.user.id ?? null)
      if (nextUserId !== sessionUserId.current) {
        requestVersion.current.value++
        verifiedUser.current = null
        sessionUserId.current = nextUserId
        setUser(null)
        setProfileError(null)
        setNeedsRecovery(false)
        setLoading(nextUserId !== null)
      }
      if (nextUserId === null) return
      void applyResult()
    })
    return () => {
      mounted.current = false
      requests.value++
      subscription.unsubscribe()
    }
  }, [applyResult])

  return (
    <AuthContext.Provider value={{ user, loading, profileError, refresh: applyResult }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
