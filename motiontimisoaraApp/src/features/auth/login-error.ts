export const WRONG_CREDENTIALS = 'Email sau parola sunt greșite.'
export const ACCOUNT_DISABLED_LOGIN =
  'Contul tău este dezactivat. Dacă nu știi de ce, scrie-ne din pagina Contact.'
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
  if (e.code === 'user_banned') return ACCOUNT_DISABLED_LOGIN
  if (e.status === 400 && e.message?.toLowerCase().includes('user is banned')) {
    return ACCOUNT_DISABLED_LOGIN
  }
  if (e.status === 400 && e.message?.toLowerCase().includes('invalid login credentials')) {
    return WRONG_CREDENTIALS
  }
  return CONNECTION_ERROR
}
