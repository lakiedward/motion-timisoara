export const MESAJ_POZA_HERO = 'Poza din capul paginii este obligatorie.'

export function mesajHeroLipsa(fisier: File | null, caleSalvata: string | null): string | null {
  if (fisier || caleSalvata) return null
  return MESAJ_POZA_HERO
}
