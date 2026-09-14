import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { toast } from 'sonner'
import { isNative } from '@/lib/platform'
import { nativeGoogle, onNativeGoogleResult } from '@/api/auth-native/google'
import { GOOGLE_ERROR } from '@/api/auth-native/coordinator'
import { withReturnUrl } from '../return-url'

export function NativeOAuthListener() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative()) return
    let active = true
    const unsubscribe = onNativeGoogleResult((result) => {
      if ('error' in result) toast.error(result.error)
      else navigate(withReturnUrl('/auth/callback', result.returnUrl), { replace: true })
    })
    const receive = (url: string) => {
      if (active)
        void nativeGoogle.receive(url).catch(() => {
          if (active) toast.error(GOOGLE_ERROR)
        })
    }
    const listener = App.addListener('appUrlOpen', ({ url }) => receive(url))
    void listener
      .then(async () => {
        if (!active) return
        await nativeGoogle.restore()
        const launch = await App.getLaunchUrl()
        if (launch?.url) receive(launch.url)
      })
      .catch(() => {
        if (active) toast.error(GOOGLE_ERROR)
      })
    return () => {
      active = false
      unsubscribe()
      void listener.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [navigate])
  return null
}
