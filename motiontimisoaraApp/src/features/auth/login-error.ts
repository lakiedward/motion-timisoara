export const WRONG_CREDENTIALS = 'Email sau parola sunt greșite.'
export const CONNECTION_ERROR =
  'Nu am putut contacta serverul de autentificare. Verifică conexiunea și încearcă din nou.'

interface SignInError {
  code?: string
  status?: number
  message?: string
}

export function loginErrorMessage(error: unknown): string {
  const e = (error ?? {}) as SignInError
  if (e.code === 'invalid_credentials') return WRONG_CREDENTIALS
  if (e.status === 400 && e.message?.toLowerCase().includes('invalid login credentials')) {
    return WRONG_CREDENTIALS
  }
  return CONNECTION_ERROR
}
