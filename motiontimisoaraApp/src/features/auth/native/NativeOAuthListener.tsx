import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { toast } from 'sonner'
import { isNative } from '@/lib/platform'
import { nativeGoogle, onNativeGoogleResult } from '@/api/auth-native/google'
import { GOOGLE_ERROR } from '@/api/auth-native/coordinator'
import { nativeEmail, onNativeEmailResult } from '@/api/auth-native/email'
import { isEmailCallback, EMAIL_LINK_ERROR } from '@/api/auth-native/email-coordinator'
import { withReturnUrl } from '../return-url'

export function NativeOAuthListener() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative()) return
    let active = true
    let launchRead = false
    const beforeLaunch = new Set<string>()
    const unsubscribe = onNativeGoogleResult((result) => {
      if ('error' in result) toast.error(result.error)
      else navigate(withReturnUrl('/auth/callback', result.returnUrl), { replace: true })
    })
    const unsubscribeEmail = onNativeEmailResult((result) => {
      if ('error' in result) {
        toast.error(result.error)
        navigate('/reset-password?invalid=1', { replace: true })
      } else if (result.kind === 'recovery') {
        navigate('/reset-password', { replace: true })
      } else {
        toast.success('Contul a fost confirmat. Te poți autentifica.')
        navigate('/login', { replace: true })
      }
    })
    const receive = (url: string) => {
      if (!active) return
      if (!launchRead) beforeLaunch.add(url)
      const email = isEmailCallback(url)
      void (email ? nativeEmail : nativeGoogle).receive(url).catch(() => {
        if (active) toast.error(email ? EMAIL_LINK_ERROR : GOOGLE_ERROR)
      })
    }
    const listener = App.addListener('appUrlOpen', ({ url }) => receive(url))
    void listener
      .then(async () => {
        if (!active) return
        await nativeGoogle.restore()
        await nativeEmail.restore()
        const launch = await App.getLaunchUrl()
        launchRead = true
        if (launch?.url && !beforeLaunch.has(launch.url)) receive(launch.url)
        beforeLaunch.clear()
      })
      .catch(() => {
        if (active) toast.error(GOOGLE_ERROR)
      })
    return () => {
      active = false
      unsubscribe()
      unsubscribeEmail()
      void listener.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [navigate])
  return null
}
