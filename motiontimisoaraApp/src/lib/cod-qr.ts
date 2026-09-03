/**
 * Conținutul codului QR al unui copil.
 *
 * `MT1:` e versiunea formatului, ca un scanner de-al nostru (#319) să știe ce
 * citește și ca un scanner străin să nu fie trimis nicăieri: nu e URL. Tokenul
 * vine din `children.qr_token` (aleatoriu, 32 de caractere hex, regenerabil
 * doar de părinte), niciodată din id-ul copilului.
 */
export const PREFIX_COD_QR = 'MT1:'

export function codQr(token: string): string {
  return `${PREFIX_COD_QR}${token}`
}

/** Tokenul dintr-un cod scanat, sau `null` dacă nu e al nostru. */
export function tokenDinCod(cod: string): string | null {
  const curat = cod.trim()
  if (!curat.startsWith(PREFIX_COD_QR)) return null
  const token = curat.slice(PREFIX_COD_QR.length)
  return /^[0-9a-f]{32}$/.test(token) ? token : null
}
