import { expect, test } from 'vitest'

import { grupeazaInLocuri, loculRandului } from './locuri'
import type { LocationRow } from '@/api/public'

function rand(over: Partial<LocationRow> & { id: string }): LocationRow {
  return {
    name: 'Loc',
    type: null,
    address: null,
    city: 'Timișoara',
    lat: null,
    lng: null,
    capacity: null,
    description: null,
    is_active: true,
    club_id: null,
    created_by_user_id: null,
    fts: null,
    ...over,
  } as LocationRow
}

// Cazul care a cerut feature-ul: doua cluburi pinuiesc aceeasi cladire, cu
// pin picker-ul, deci coordonatele coincid la perfectie.
test('două rânduri în același punct dau un singur loc', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', name: 'Bazin Olimpic Timișoara', lat: 45.7489, lng: 21.2087, club_id: 'c1' }),
    rand({ id: 'b', name: 'Bazinul Olimpic', lat: 45.7489, lng: 21.2087, club_id: 'c2' }),
  ])
  expect(locuri).toHaveLength(1)
  expect(locuri[0]!.randuri.map((r) => r.id)).toEqual(['a', 'b'])
  expect(locuri[0]!.cluburi).toBe(2)
})

// ~11 metri: aceeasi cladire, dar nu si vecina ei.
test('pini la câțiva metri distanță cad în același loc', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', lat: 45.74891, lng: 21.20872 }),
    rand({ id: 'b', lat: 45.74893, lng: 21.20874 }),
  ])
  expect(locuri).toHaveLength(1)
})

test('clădirea de peste drum rămâne alt loc', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'b', lat: 45.7495, lng: 21.2093 }),
  ])
  expect(locuri).toHaveLength(2)
})

// Harta n-are unde sa le puna; inainte erau filtrate in pagina.
test('rândurile fără coordonate nu ajung pe hartă', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', lat: null, lng: null }),
    rand({ id: 'b', lat: 45.75, lng: null }),
    rand({ id: 'c', lat: 45.7489, lng: 21.2087 }),
  ])
  expect(locuri.map((l) => l.randuri[0]!.id)).toEqual(['c'])
})

test('numele locului e cel folosit de cei mai mulți', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', name: 'Bazinul Olimpic', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'b', name: 'Bazin Olimpic Timișoara', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'c', name: 'Bazin Olimpic Timișoara', lat: 45.7489, lng: 21.2087 }),
  ])
  expect(locuri[0]!.nume).toBe('Bazin Olimpic Timișoara')
})

// La egalitate decide cine chiar tine cursuri acolo, nu ordinea din baza.
test('la egalitate câștigă numele rândului cu mai multe cursuri', () => {
  const locuri = grupeazaInLocuri(
    [
      rand({ id: 'a', name: 'Sala Mică', lat: 45.757, lng: 21.225 }),
      rand({ id: 'b', name: 'Sala Polivalentă', lat: 45.757, lng: 21.225 }),
    ],
    new Map([
      ['a', 1],
      ['b', 6],
    ]),
  )
  expect(locuri[0]!.nume).toBe('Sala Polivalentă')
})

// Fara asta, rezultatul s-ar fi schimbat de la o randare la alta.
test('la egalitate deplină, ordinea primită decide — stabil', () => {
  const intrare = [
    rand({ id: 'a', name: 'Primul', lat: 45.76, lng: 21.23 }),
    rand({ id: 'b', name: 'Al doilea', lat: 45.76, lng: 21.23 }),
  ]
  expect(grupeazaInLocuri(intrare)[0]!.nume).toBe('Primul')
  expect(grupeazaInLocuri(intrare)[0]!.nume).toBe('Primul')
})

test('adresa vine de la primul rând care are una', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', address: null, lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'b', address: 'Str. Înotului 1', lat: 45.7489, lng: 21.2087 }),
  ])
  expect(locuri[0]!.address).toBe('Str. Înotului 1')
})

// Randurile fara club nu umfla numaratoarea din antet.
test('doar cluburile distincte se numără, iar rândurile fără club nu', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', club_id: 'c1', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'b', club_id: 'c1', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'c', club_id: null, lat: 45.7489, lng: 21.2087 }),
  ])
  expect(locuri[0]!.cluburi).toBe(1)
})

// Linkurile din aplicatie trimit un ID DE RAND. Daca asta se rupe, fiecare
// `/harta?location=<id>` deschide harta si nu se intampla nimic.
test('un rând se regăsește în locul lui, oricare din grup ar fi', () => {
  const locuri = grupeazaInLocuri([
    rand({ id: 'a', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'b', lat: 45.7489, lng: 21.2087 }),
    rand({ id: 'c', lat: 45.76, lng: 21.23 }),
  ])
  expect(loculRandului(locuri, 'b')!.cheie).toBe(loculRandului(locuri, 'a')!.cheie)
  expect(loculRandului(locuri, 'c')!.cheie).not.toBe(loculRandului(locuri, 'a')!.cheie)
  expect(loculRandului(locuri, 'nu-exista')).toBeUndefined()
})
