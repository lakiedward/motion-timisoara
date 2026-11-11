import type { CompetitionSelection } from '@/api/competition/competition-registration'
import { advanceHint } from '@/features/account/checkout/checkout-flow'

export function participantKey(selection: CompetitionSelection): string {
  return selection.childId ?? 'self'
}

export function selectionKey(
  selections: CompetitionSelection[],
  versions: Record<string, string>,
): string {
  return JSON.stringify(
    selections.map((selection) => [
      participantKey(selection),
      selection.categoryId,
      'selfBirthDate' in selection ? selection.selfBirthDate : null,
      versions[participantKey(selection)] ?? '',
    ]),
  )
}

export function validBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  )
}

export const PARTICIPANTS_COPY = {
  title: 'Cine participă?',
  text: 'Alege categoria pentru fiecare participant.',
}

export function competitionAdvanceHint({
  step,
  selectionCount,
  includeSelf,
  selfComplete,
  checking,
  pricesReady,
  accepted,
}: {
  step: string
  selectionCount: number
  includeSelf: boolean
  selfComplete: boolean
  checking: boolean
  pricesReady: boolean
  accepted: boolean
}): string | null {
  if (step !== 'Participanți') return advanceHint(step, selectionCount, accepted)
  if (includeSelf && !selfComplete) {
    return 'Completează data nașterii și categoria ta ca să continui.'
  }
  if (selectionCount === 0) return advanceHint(step, 0, accepted)
  if (checking) return 'Verificăm categoria și prețul…'
  if (!pricesReady) return 'Alege o categorie potrivită pentru fiecare participant ca să continui.'
  return null
}
