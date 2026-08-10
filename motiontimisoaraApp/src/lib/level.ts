const LEVEL_RO: Record<string, string> = {
  incepator: 'Începător',
  intermediar: 'Intermediar',
  avansat: 'Avansat',
}

/** Display label for a course level slug (diacritics). Falls back to the raw value. */
export function formatLevel(level: string | null | undefined): string | null {
  if (!level) return null
  return LEVEL_RO[level.toLowerCase()] ?? level
}
