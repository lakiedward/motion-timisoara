import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import type { Database } from '@/lib/database.types'
import { isNative } from '@/lib/platform'
import { webRecoveryGrant } from '@/lib/auth/recovery-grant'

const nativeStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key })
  },
}

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isNative(),
    ...(isNative() ? { storage: nativeStorage as never } : {}),
  },
})

if (!isNative()) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) webRecoveryGrant.issue(session)
    else if (event !== 'INITIAL_SESSION' && !webRecoveryGrant.valid(session))
      webRecoveryGrant.clear()
  })
}
