/**
 * Tipurile modulului de măsurare. Scrise de mână fiindcă `ui-conventions.mjs`
 * trăiește în afara lui `src/` — acolo unde poate folosi `node:fs`, pe care
 * tsconfig.app.json nu-l tipizează (`types` nu include "node").
 */

export interface FisierCuNumar {
  fisier: string
  cate: number
}

export interface Contrast {
  pereche: string
  fundal: string
  cerneala: string
  raport: number
}

export interface FiltruDeData {
  fisier: string
  filtru: string
}

export interface PointerRupt {
  conventie: string
  cale: string
}

export interface Masuratoare {
  nume: string
  stare: string
  insemn: string
  regula: string[]
  randuri: [string, string][]
}

export declare const EXCEPTII_HEX: Record<string, string>

export declare function ecraneFaraRamuraDeEroare(): string[]
export declare function trateazaEroareaDeCitire(sursa: string): boolean
export declare function ecraneCareIncarcaDate(): string[]

export declare function tinteTactileScriseDeMana(): FisierCuNumar[]
export declare function tokenDeTintaTactila(): string | null

export declare function copiiLocaleDeSchelet(): string[]
export declare function consumatoriDeSchelet(): string[]

export declare function literaleHexInComponente(): FisierCuNumar[]

export declare function tokeniDeCuloare(): Record<string, string>
export declare function raportContrast(a: string, b: string): number
export declare function contrastePeCuloriDeBrand(): Contrast[]

export declare function filtreDeDataInInterogari(): FiltruDeData[]
export declare function consumatoriDeSAIncheiat(): string[]

export declare function masoaraTot(): Masuratoare[]
export declare function randeaza(masuratori: Masuratoare[]): string
export declare function textulAsteptat(): string
export declare function textulDePeDisc(): string
export declare function caleaFisierului(): string
export declare function pointeriCareNuSeRezolva(): PointerRupt[]
