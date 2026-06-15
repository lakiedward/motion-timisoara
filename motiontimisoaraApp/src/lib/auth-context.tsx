import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { loadAppUser, type AppUser } from '@/api/auth'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  /** Re-read the profile (e.g. after completing profile or role change). */
  refresh: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setUser(await loadAppUser())
  }, [])

  React.useEffect(() => {
    let active = true
    loadAppUser().then((u) => {
      if (active) {
        setUser(u)
        setLoading(false)
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAppUser().then((u) => {
        if (active) setUser(u)
      })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
