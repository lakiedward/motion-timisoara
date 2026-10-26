import type { ClubListItem } from '@/api/public'

export type ContactKind = 'address' | 'website' | 'email' | 'phone'

export type ContactRow = {
  kind: ContactKind
  label: string
  value: string
  href?: string
  external?: boolean
}

export function websiteHref(raw: string): string {
  const value = raw.trim()
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function websiteLabel(raw: string): string {
  try {
    return new URL(websiteHref(raw)).host.replace(/^www\./, '')
  } catch {
    return raw.trim()
  }
}

export function clubAddress(club: Pick<ClubListItem, 'address' | 'city'>): string {
  return [club.address?.trim(), club.city?.trim()].filter(Boolean).join(', ')
}

export function clubContactRows(club: ClubListItem): ContactRow[] {
  const rows: ContactRow[] = []
  const address = clubAddress(club)
  if (address) rows.push({ kind: 'address', label: 'Adresă', value: address })
  const phone = club.phone?.trim()
  if (phone) {
    rows.push({
      kind: 'phone',
      label: 'Telefon',
      value: phone,
      href: `tel:${phone.replace(/[^\d+]/g, '')}`,
    })
  }
  const email = club.public_email?.trim()
  if (email) rows.push({ kind: 'email', label: 'Email', value: email, href: `mailto:${email}` })
  const website = club.website?.trim()
  if (website) {
    rows.push({
      kind: 'website',
      label: 'Website',
      value: websiteLabel(website),
      href: websiteHref(website),
      external: true,
    })
  }
  return rows
}
