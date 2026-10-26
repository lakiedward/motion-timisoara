export type OperatorField = {
  label: string
  value: string | null
}

export const PRIVACY_EMAIL = 'contact@motionromania.com'

export const OPERATOR_FIELDS: OperatorField[] = [
  { label: 'Denumire', value: null },
  { label: 'CUI', value: null },
  { label: 'Nr. Registrul Comerțului', value: null },
  { label: 'Sediu', value: null },
  { label: 'Email pentru date personale', value: PRIVACY_EMAIL },
]
