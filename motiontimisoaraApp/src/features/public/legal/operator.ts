export type OperatorField = {
  label: string
  value: string | null
}

export const PRIVACY_EMAIL = 'office@motionromania.ro'

export const OPERATOR_FIELDS: OperatorField[] = [
  { label: 'Denumire', value: 'TITUS CLUB SWIM&FUN S.R.L.' },
  { label: 'CUI', value: '49252540' },
  { label: 'Nr. Registrul Comerțului', value: 'J35/4752/2023' },
  { label: 'Sediu', value: 'Str. Arieș nr. 2, sat Ghiroda, comuna Ghiroda, județul Timiș' },
  { label: 'Email pentru date personale', value: PRIVACY_EMAIL },
]
