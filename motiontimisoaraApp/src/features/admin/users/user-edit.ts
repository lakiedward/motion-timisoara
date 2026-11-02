import { z } from 'zod'

import type { AdminUserProfile, AdminUserProfileInput } from '@/api/accounts/admin-accounts'

export const adminUserSchema = z.object({
  name: z.string().trim().min(2, 'Minim 2 caractere'),
  phone: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^(\+?[0-9]{8,15})?$/, 'Număr de telefon invalid')),
  bio: z.string(),
})

export type AdminUserValues = z.input<typeof adminUserSchema>
export type AdminUserParsed = z.output<typeof adminUserSchema>

export function toPatch(
  values: AdminUserParsed,
  user: Pick<AdminUserProfile, 'role' | 'phoneKnown'>,
): AdminUserProfileInput {
  const patch: AdminUserProfileInput = { name: values.name }
  if (user.phoneKnown) patch.phone = values.phone || null
  if (user.role === 'COACH') patch.bio = values.bio.trim() || null
  return patch
}
