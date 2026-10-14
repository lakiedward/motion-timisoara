import { CONNECTION_ERROR } from './login-error'

export const EMAIL_TAKEN = 'Există deja un cont cu acest email.'
export const SIGNUP_FAILED = 'Nu am putut crea contul. Verifică datele și încearcă din nou.'

interface SignUpError {
  name?: string
  code?: string
  status?: number
  message?: string
}

export function signupErrorMessage(error: unknown): string {
  const e = (error ?? {}) as SignUpError
  const message = e.message?.toLowerCase() ?? ''
  if (e.code === 'user_already_exists' || e.code === 'email_exists') return EMAIL_TAKEN
  if (message.includes('already registered') || message.includes('already been registered')) {
    return EMAIL_TAKEN
  }
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) return SIGNUP_FAILED
  return CONNECTION_ERROR
}
