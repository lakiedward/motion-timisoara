import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { loadAppUserResult, type AppUser } from '@/api/auth'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  /** Set when a session exists but the profiles row could not be loaded. */
  profileError: string | null
  /** Re-read the profile (e.g. after completing profile or role change). */
  refresh: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [profileError, setProfileError] = React.useState<string | null>(null)

  const applyResult = React.useCallback(async () => {
    const result = await loadAppUserResult()
    if (result.status === 'ok') {
      setUser(result.user)
      setProfileError(null)
    } else if (result.status === 'signed_out') {
      setUser(null)
      setProfileError(null)
    } else {
      setUser(null)
      setProfileError(result.message)
    }
  }, [])

  const refresh = React.useCallback(async () => {
    await applyResult()
  }, [applyResult])

  React.useEffect(() => {
    let active = true
    loadAppUserResult().then((result) => {
      if (!active) return
      if (result.status === 'ok') {
        setUser(result.user)
        setProfileError(null)
      } else if (result.status === 'signed_out') {
        setUser(null)
        setProfileError(null)
      } else {
        setUser(null)
        setProfileError(result.message)
      }
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAppUserResult().then((result) => {
        if (!active) return
        if (result.status === 'ok') {
          setUser(result.user)
          setProfileError(null)
        } else if (result.status === 'signed_out') {
          setUser(null)
          setProfileError(null)
        } else {
          setUser(null)
          setProfileError(result.message)
        }
      })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, profileError, refresh }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
