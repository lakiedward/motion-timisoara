import type { ClubLocation } from '@/api/club'

export function formatAdresa(l: Pick<ClubLocation, 'address' | 'city'>): string {
  return [l.address, l.city].filter(Boolean).join(', ') || '—'
}

export function grupeazaDupaStare(locations: ClubLocation[]) {
  const ordonate = [...locations].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  return {
    active: ordonate.filter((l) => l.is_active),
    inactive: ordonate.filter((l) => !l.is_active),
  }
}
