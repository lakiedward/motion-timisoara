const DARK_QUERY = '(prefers-color-scheme: dark)'

export function applySystemTheme(root: HTMLElement, prefersDark: boolean) {
  root.classList.toggle('dark', prefersDark)
}

export function syncSystemTheme(root: HTMLElement = document.documentElement) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  const update = () => applySystemTheme(root, query.matches)
  update()
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}
