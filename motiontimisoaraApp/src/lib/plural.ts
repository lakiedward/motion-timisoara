/**
 * Acordul la numar in romana, pentru texte de forma „2 prezente" / „1 prezenta".
 *
 * Regula care se uita usor: de la 20 in sus, numeralul cere „de" — „20 de sedinte",
 * dar „19 sedinte". Nu se uita dupa numarul intreg, ci dupa ultimele doua cifre:
 * 101 nu cere „de" (o suta una sedinte), 120 cere. Multiplii de 100 cer si ei.
 */
function cereDe(n: number): boolean {
  const ultimeleDoua = Math.abs(n) % 100
  return Math.abs(n) >= 20 && (ultimeleDoua === 0 || ultimeleDoua >= 20)
}

/**
 * `plural(1, 'prezenta', 'prezente')` → „1 prezenta"
 * `plural(3, 'sedinta', 'sedinte')` → „3 sedinte"
 * `plural(21, 'sedinta', 'sedinte')` → „21 de sedinte"
 *
 * Intoarce doar textul de dupa numar cand `faraNumar` e adevarat, ca apelantul
 * sa poata ingrosa cifra separat.
 */
export function plural(n: number, singular: string, pluralForm: string, faraNumar = false): string {
  const cuvant = n === 1 ? singular : pluralForm
  const coada = cereDe(n) ? `de ${cuvant}` : cuvant
  return faraNumar ? coada : `${n} ${coada}`
}
