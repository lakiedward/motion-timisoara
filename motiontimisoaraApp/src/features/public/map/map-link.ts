export function linkHartaLoc(
  lat: number,
  lng: number,
  nume: string,
  platforma: 'web' | 'ios' | 'android',
) {
  const q = encodeURIComponent(nume)
  if (platforma === 'ios') return { href: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}` }
  if (platforma === 'android') {
    return { href: `geo:${lat},${lng}?q=${lat},${lng}(${q})` }
  }
  return {
    href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    target: '_blank' as const,
    rel: 'noopener noreferrer',
  }
}
