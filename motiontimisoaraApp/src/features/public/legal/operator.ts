export type OperatorField = {
  label: string
  value: string | null
}

export const PRIVACY_EMAIL = 'office@motionromania.ro'

export const OPERATOR_NAME = 'TITUS CLUB SWIM&FUN S.R.L.'
export const OPERATOR_CUI = '49252540'
export const OPERATOR_REG_COM = 'J35/4752/2023'

export const OPERATOR_FIELDS: OperatorField[] = [
  { label: 'Denumire', value: OPERATOR_NAME },
  { label: 'CUI', value: OPERATOR_CUI },
  { label: 'Nr. Registrul Comerțului', value: OPERATOR_REG_COM },
  { label: 'Sediu', value: 'Str. Arieș nr. 2, sat Ghiroda, comuna Ghiroda, județul Timiș' },
  { label: 'Email pentru date personale', value: PRIVACY_EMAIL },
]
