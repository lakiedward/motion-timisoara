import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { signInWithApple } from '@/api/auth'
import {
  APPLE_ERROR,
  isAppleSignInCancelled,
  shouldOfferAppleSignIn,
  signInNativeApple,
  usesNativeAppleSignIn,
} from '@/api/auth-native/apple'
import { oauthCallbackUrl } from '@/lib/auth/return-path'
import { withReturnUrl } from '../return-url'

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.52 12.72c.03 3.18 2.79 4.24 2.82 4.25-.02.07-.44 1.5-1.45 2.97-.87 1.27-1.78 2.53-3.2 2.56-1.4.02-1.85-.83-3.45-.83-1.6 0-2.1.8-3.43.85-1.38.05-2.43-1.37-3.31-2.63-1.8-2.58-3.18-7.3-1.33-10.49.92-1.58 2.56-2.58 4.34-2.61 1.35-.03 2.63.91 3.45.91.82 0 2.36-1.13 3.98-.96.68.03 2.58.27 3.8 2.07-.1.06-2.27 1.33-2.22 3.91ZM13.7 5.9c.73-.88 1.22-2.11 1.09-3.33-1.05.04-2.32.7-3.07 1.58-.68.78-1.27 2.04-1.11 3.24 1.17.09 2.37-.6 3.09-1.49Z"
      />
    </svg>
  )
}

export function AppleSignInButton({
  label = 'Continuă cu Apple',
  returnUrl,
  disabled = false,
}: {
  label?: string
  returnUrl?: string
  disabled?: boolean
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  if (!shouldOfferAppleSignIn()) return null
  const onClick = async () => {
    setLoading(true)
    try {
      if (usesNativeAppleSignIn()) {
        await signInNativeApple()
        navigate(withReturnUrl('/auth/callback', returnUrl), { replace: true })
      } else {
        const { error } = await signInWithApple(oauthCallbackUrl(window.location.origin, returnUrl))
        if (error) toast.error(APPLE_ERROR)
      }
    } catch (error) {
      if (!isAppleSignInCancelled(error)) toast.error(APPLE_ERROR)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button
      type="button"
      variant="apple"
      className="w-full"
      onClick={onClick}
      disabled={disabled || loading}
    >
      <AppleMark />
      {loading ? 'Se conectează cu Apple…' : label}
    </Button>
  )
}
