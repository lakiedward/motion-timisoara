export function campRulesForSave(value: string): string | null {
  const text = value.trim()
  return text.length > 0 ? text : null
}

export function campRulesForDisplay(value: string | null | undefined): string | null {
  return campRulesForSave(value ?? '')
}
