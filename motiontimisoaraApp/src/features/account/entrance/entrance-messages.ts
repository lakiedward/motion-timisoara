import type { EntranceOption, EntranceOptionState } from '@/api/attendance/entrance'
import { plural } from '@/lib/plural'

const TZ = 'Europe/Bucharest'

const time = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const day = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
})
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })

export const optionKey = (option: EntranceOption) => `${option.occurrenceId}:${option.childId}`

export type EntranceMessage = { title: string; text: string }

export function sessionTime(startsAt: string, endsAt: string): string {
  return `${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`
}

export function nextOpening(nextOpensAt: string, serverTime: string | null): string {
  const opens = new Date(nextOpensAt)
  const now = serverTime ? new Date(serverTime) : new Date()
  const hour = time.format(opens)
  const today = dayKey.format(now)
  const tomorrow = dayKey.format(new Date(now.getTime() + 86_400_000))
  const target = dayKey.format(opens)
  if (target === today) return `azi la ${hour}`
  if (target === tomorrow) return `mâine la ${hour}`
  return `${day.format(opens)} la ${hour}`
}

export function optionsProblem(
  code: string,
  coachName: string | null,
  nextOpensAt: string | null,
  serverTime: string | null,
): EntranceMessage {
  const coach = coachName ? ` lui ${coachName}` : ''
  switch (code) {
    case 'OUTSIDE_WINDOW':
      return {
        title: 'Acum nu e nicio ședință deschisă',
        text: nextOpensAt
          ? `Prezența se marchează de la 15 minute înainte de ședință până la final. Următoarea fereastră se deschide ${nextOpening(nextOpensAt, serverTime)}.`
          : `Prezența se marchează de la 15 minute înainte de ședință până la final. Nu mai e programată nicio ședință la cursurile${coach}.`,
      }
    case 'NOT_ENROLLED':
      return {
        title: 'Niciun copil înscris aici',
        text: `Copiii tăi nu au o înscriere activă la cursurile${coach}. Dacă tocmai v-ați înscris, cere antrenorului să confirme înscrierea.`,
      }
    case 'INVALID_CODE':
      return {
        title: 'Codul nu mai e valabil',
        text: 'Poate antrenorul a printat o foaie nouă. Scanează codul de pe foaia de la intrare sau cere-i antrenorului să-l ponteze din catalog.',
      }
    case 'FORBIDDEN':
      return {
        title: 'Codul de la intrare e pentru părinți',
        text: 'Intră în contul de părinte cu care ți-ai înscris copilul. Antrenorii pontează din pagina Prezență.',
      }
    default:
      return {
        title: 'Nu am putut verifica ședințele',
        text: 'Reîncearcă. Dacă nu merge, antrenorul te poate ponta din catalog.',
      }
  }
}

export function checkinProblem(code: string): EntranceMessage {
  switch (code) {
    case 'OUTSIDE_WINDOW':
      return {
        title: 'Fereastra ședinței s-a închis',
        text: 'Prezența se marchează de la 15 minute înainte de ședință până la final. Cere-i antrenorului să-l ponteze din catalog.',
      }
    case 'MANUAL_OVERRIDE':
      return {
        title: 'Antrenorul a corectat deja prezența',
        text: 'Corecția antrenorului are prioritate, așa că nu o putem schimba de aici. Vorbește cu antrenorul dacă e o greșeală.',
      }
    case 'NO_REMAINING_SESSIONS':
      return {
        title: 'Nu mai are ședințe rămase',
        text: 'Abonamentul s-a consumat. Reînnoiește-l din Înscrieri sau plătește antrenorului.',
      }
    case 'NOT_ENROLLED':
      return {
        title: 'Copilul nu e înscris la acest curs',
        text: 'Nu are o înscriere activă la cursul ședinței. Verifică în Înscrieri.',
      }
    case 'AMBIGUOUS_ENROLLMENT':
      return {
        title: 'Înscrierea are nevoie de verificare',
        text: 'Copilul are două înscrieri active la același curs. Antrenorul îl pontează din catalog până când se rezolvă.',
      }
    case 'INVALID_CODE':
    case 'FORBIDDEN':
      return optionsProblem(code, null, null, null)
    default:
      return {
        title: 'Prezența nu a fost salvată',
        text: 'Reîncearcă. Dacă nu merge, antrenorul te poate ponta din catalog.',
      }
  }
}

export function stateLabel(state: EntranceOptionState): string | null {
  switch (state) {
    case 'ALREADY_PRESENT':
      return 'Prezență salvată'
    case 'MANUAL_OVERRIDE':
      return 'Corectat de antrenor'
    case 'NO_REMAINING_SESSIONS':
      return 'Fără ședințe rămase'
    case 'AMBIGUOUS_ENROLLMENT':
      return 'De verificat de antrenor'
    default:
      return null
  }
}

export function remainingText(remaining: number | null): string | null {
  if (remaining === null) return null
  if (remaining === 0) return 'Nu mai are ședințe rămase.'
  if (remaining === 1) return 'Mai are o ședință în abonament.'
  return `Mai are ${plural(remaining, 'ședință', 'ședințe')} în abonament.`
}
