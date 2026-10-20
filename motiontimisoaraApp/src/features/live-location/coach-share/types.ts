import type { LiveLocationSharing } from '../live-location-context'

export type CoachShareView = {
  camp: boolean
  occurrenceId: string | null
  eligibleTime: boolean
  checked: boolean
  error: string | null
  sharing: LiveLocationSharing
  onConsent: (checked: boolean) => void
  onStart: () => void
  onStop: () => void
}

export function formatClock(iso: string, seconds = false) {
  return new Date(iso).toLocaleTimeString(
    'ro-RO',
    seconds ? undefined : { hour: '2-digit', minute: '2-digit' },
  )
}

export function audienceText(camp: boolean) {
  return camp
    ? 'Clubul organizator și părinții cu un copil înscris activ, cu sosirea confirmată și fără plecare înregistrată, pot vedea locația ta după ce își dau acordul. Partajarea apare în Anunțuri și poate continua în fundal. Se oprește automat după 8 ore sau la încheierea taberei, dacă aceasta se termină mai devreme.'
    : 'Clubul organizator și părinții care își dau acordul și au un copil înscris, prezent prin cod QR la această ședință, pot vedea locația ta. Partajarea continuă în fundal pe dispozitivele compatibile și se oprește cel târziu la 15 minute după încheierea ședinței.'
}

export function windowText(camp: boolean) {
  return camp
    ? 'Partajarea este disponibilă numai în perioada taberei.'
    : 'Partajarea este disponibilă numai în timpul ședinței și încă 15 minute după încheiere.'
}

export function consentText(camp: boolean) {
  return camp
    ? 'Sunt de acord să partajez locația mea pentru această tabără.'
    : 'Sunt de acord să partajez locația mea pentru această ședință.'
}

export const retentionText =
  'Poți opri oricând. Se păstrează doar ultima poziție, care este ștearsă la oprire sau expirare.'
