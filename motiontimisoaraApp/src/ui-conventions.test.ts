/**
 * Plafoanele convențiilor UI.
 *
 * Ce face suita asta: NU cere ca aplicația să fie curată. Cere ca ce e curat
 * să rămână curat, iar ce e în derivă să nu se lățească. Cifrele de mai jos
 * sunt starea măsurată la 2026-08-28 — scad când repari ceva, nu cresc niciodată.
 *
 * Documentul pe care îl citește sesiunea de spec e docs/ui-conventions.md,
 * generat din exact aceleași funcții (`npm run conventions`).
 */

import { expect, test } from 'vitest'

import {
  consumatoriDeSAIncheiat,
  consumatoriDeSchelet,
  contrastePeCuloriDeBrand,
  copiiLocaleDeSchelet,
  ecraneCareIncarcaDate,
  ecraneFaraRamuraDeEroare,
  filtreDeDataInInterogari,
  literaleHexInComponente,
  pointeriCareNuSeRezolva,
  raportContrast,
  textulAsteptat,
  textulDePeDisc,
  trateazaEroareaDeCitire,
} from '../scripts/ui-conventions.mjs'

/* ------------------------------------------------------------------ *
 * Plafoanele. Un singur loc, ca schimbarea lor să se vadă în diff.
 * ------------------------------------------------------------------ */

const PLAFON_ECRANE_OARBE = 28
const PLAFON_LITERALE_HEX = 1
const CONTRAST_MINIM = 4.5

/* ------------------------------------------------------------------ *
 * Convențiile
 * ------------------------------------------------------------------ */

test('stare de eroare: nu mai multe ecrane oarbe decât azi', () => {
  const oarbe = ecraneFaraRamuraDeEroare()
  // Mesajul listează fișierele, ca cel care înroșește testul să vadă care e al lui.
  expect(oarbe.length, `ecrane fără ramură de eroare:\n${oarbe.join('\n')}`).toBeLessThanOrEqual(
    PLAFON_ECRANE_OARBE
  )
})

test('forme de așteptare: nicio copie locală a scheletului', () => {
  expect(copiiLocaleDeSchelet()).toEqual([])
})

test('culorile de brand: nicio literală hex nouă în componente', () => {
  const gasite = literaleHexInComponente()
  const total = gasite.reduce((suma, g) => suma + g.cate, 0)
  expect(total, JSON.stringify(gasite)).toBeLessThanOrEqual(PLAFON_LITERALE_HEX)
})

test('contrast: fiecare pereche de tokeni trece pragul AA', () => {
  const slabe = contrastePeCuloriDeBrand().filter((c) => c.raport < CONTRAST_MINIM)
  expect(slabe, JSON.stringify(slabe)).toEqual([])
})

test('fus orar: niciun filtru de dată împins în interogare', () => {
  // gte/lte pe o coloană de dată taie la miezul nopții UTC. Decizia se ia
  // în fusul cititorului, în JS — src/api/camps.ts sAIncheiat().
  expect(filtreDeDataInInterogari()).toEqual([])
})

/* ------------------------------------------------------------------ *
 * Măsurătoarea însăși — fără astea, plafoanele pot deveni verzi pe gol
 * ------------------------------------------------------------------ */

test('măsurătoarea recunoaște eroarea destructurată din useQuery', () => {
  expect(trateazaEroareaDeCitire('const { data, isError } = useQuery({ queryKey: [] })')).toBe(true)
  expect(trateazaEroareaDeCitire('const { data, error } = useQuery({ queryKey: [] })')).toBe(true)
})

test('măsurătoarea recunoaște eroarea citită de pe rezultat', () => {
  expect(trateazaEroareaDeCitire('const q = useQuery({ queryKey: [] })\nif (q.isError) return null')).toBe(true)
})

test('măsurătoarea NU ia toast.error drept ramură de eroare', () => {
  // O mutație care raportează eșecul nu spune nimic despre ce vede omul
  // când CITIREA cade. Dacă asta ar trece, plafonul ar fi verde pe gol.
  const sursa = 'const { data } = useQuery({ queryKey: [] })\nonError: () => toast.error("nu merge")'
  expect(trateazaEroareaDeCitire(sursa)).toBe(false)
})

test('măsurătoarea chiar găsește ecrane, nu returnează liste goale', () => {
  // Dacă un refactor rupe mersul prin fișiere, totul ar deveni verde în tăcere.
  expect(ecraneCareIncarcaDate().length).toBeGreaterThan(30)
  expect(consumatoriDeSchelet().length).toBeGreaterThan(20)
  expect(consumatoriDeSAIncheiat().length).toBeGreaterThan(0)
  expect(contrastePeCuloriDeBrand().length).toBeGreaterThan(5)
})

test('raportul de contrast e calculat, nu presupus', () => {
  expect(raportContrast('#ffffff', '#000000')).toBeCloseTo(21, 2)
  expect(raportContrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
})

/* ------------------------------------------------------------------ *
 * Fișierul generat
 * ------------------------------------------------------------------ */

test('fiecare pointer canonic se rezolvă pe disc', () => {
  // O convenție care arată spre un fișier mutat nu e slăbită, e mincinoasă.
  expect(pointeriCareNuSeRezolva()).toEqual([])
})

test('docs/ui-conventions.md e ce măsoară codul azi', () => {
  expect(textulDePeDisc(), 'rulează `npm run conventions`').toBe(textulAsteptat())
})
