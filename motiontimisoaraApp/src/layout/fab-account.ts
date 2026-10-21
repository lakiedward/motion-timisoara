export function isFabAccountVisible(authenticated: boolean, pathname: string) {
  return authenticated && pathname !== '/account' && !pathname.startsWith('/account/')
}
