import { beforeEach, expect, test, vi } from 'vitest'

import { getConcursuriPublice } from './competition/competitions'
import { getTaberePublice } from './camps'
import { getHomeStats } from './home'
import {
  getActivitatiPublice,
  getActivities,
  getClubCourses,
  getClubHeadquarters,
  getCoachCourses,
  getCoaches,
  getCourseCatalog,
  getCourses,
  getPublicClubs,
} from './public'

let apeluri: { tabela: string; metoda: string; argumente: unknown[] }[] = []

function tabela(nume: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve({ data: [], error: null, count: 0 }))
      }
      return (...argumente: unknown[]) => {
        apeluri.push({ tabela: nume, metoda: prop, argumente })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (nume: string) => tabela(nume),
    rpc: async () => ({ data: null, error: null }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}))

beforeEach(() => {
  apeluri = []
})

function tabeleFiltrate() {
  return apeluri
    .filter(
      (a) =>
        a.metoda === 'filter' &&
        a.argumente[0] === 'hidden_from_public' &&
        a.argumente[1] === 'is' &&
        a.argumente[2] === false,
    )
    .map((a) => a.tabela)
}

test.each([
  ['getCourses', () => getCourses(), ['courses']],
  ['getCourseCatalog', () => getCourseCatalog(), ['courses']],
  ['getActivities', () => getActivities(), ['activities']],
  ['getActivitatiPublice', () => getActivitatiPublice(), ['activities']],
  ['getTaberePublice', () => getTaberePublice(), ['camps']],
  ['getConcursuriPublice', () => getConcursuriPublice(), ['competitions']],
  ['getCoaches', () => getCoaches(), ['coach_profiles']],
  ['getPublicClubs', () => getPublicClubs(), ['clubs']],
  ['getClubHeadquarters', () => getClubHeadquarters(), ['clubs']],
  ['getHomeStats', () => getHomeStats(), ['clubs', 'coach_profiles', 'courses']],
])('%s ascunde conturile de test din lista publică', async (_nume, apel, tabele) => {
  await apel()
  expect(tabeleFiltrate().sort()).toEqual([...tabele].sort())
})

test.each([
  ['cursurile unui antrenor', () => getCoachCourses('c1')],
  ['cursurile unui club', () => getClubCourses('k1')],
  ['activitățile unui club', () => getActivitatiPublice(new Date(), 'k1')],
  ['activitățile unui antrenor', () => getActivitatiPublice(new Date(), undefined, 'c1')],
  ['taberele unui club', () => getTaberePublice(new Date(), 'k1')],
])('%s rămân vizibile pe pagina proprietarului', async (_nume, apel) => {
  await apel()
  expect(tabeleFiltrate()).toEqual([])
})
