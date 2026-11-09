import type { RefinementCtx } from 'zod'

export const MAX_AGE = 99

const validAge = (age: number | null | undefined): age is number =>
  age != null && Number.isInteger(age) && age >= 0 && age <= MAX_AGE

export function formatAgeRange(
  ageFrom: number | null | undefined,
  ageTo: number | null | undefined,
) {
  const from = validAge(ageFrom) ? ageFrom : null
  const to = validAge(ageTo) && (from == null || ageTo >= from) ? ageTo : null
  if (from != null && to != null) return `${from}–${to} ani`
  if (from != null) return `de la ${from} ani`
  if (to != null) return `până la ${to} ani`
  return null
}

function ageInputError(raw: string | undefined) {
  if (!raw?.trim()) return null
  const age = Number(raw)
  if (!Number.isInteger(age)) return 'Scrie vârsta ca număr întreg.'
  if (age < 0 || age > MAX_AGE) return `Vârsta trebuie să fie între 0 și ${MAX_AGE} ani.`
  return null
}

export function validateAgeRangeFields(
  value: { age_from?: string; age_to?: string },
  ctx: RefinementCtx,
) {
  const fromError = ageInputError(value.age_from)
  const toError = ageInputError(value.age_to)
  if (fromError) ctx.addIssue({ code: 'custom', path: ['age_from'], message: fromError })
  if (toError) ctx.addIssue({ code: 'custom', path: ['age_to'], message: toError })
  if (fromError || toError || !value.age_from?.trim() || !value.age_to?.trim()) return
  if (Number(value.age_to) < Number(value.age_from)) {
    ctx.addIssue({
      code: 'custom',
      path: ['age_to'],
      message: 'Vârsta maximă nu poate fi mai mică decât cea minimă.',
    })
  }
}
