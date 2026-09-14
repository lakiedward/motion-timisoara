import { useSearchParams } from 'react-router-dom'
import { validReturnPath } from '@/lib/auth/return-path'

export function useReturnUrl(): string | undefined {
  const [params] = useSearchParams()
  return validReturnPath(params.get('returnUrl') || params.get('redirect'))
}

export function withReturnUrl(path: string, returnUrl: string | undefined): string {
  return returnUrl ? `${path}?returnUrl=${encodeURIComponent(returnUrl)}` : path
}
