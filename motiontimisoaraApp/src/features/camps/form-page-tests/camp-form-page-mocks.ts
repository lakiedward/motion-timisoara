import { vi } from 'vitest'

vi.mock('@/api/camps-admin', async () => {
  const real = await vi.importActual<typeof import('@/api/camps-admin')>('@/api/camps-admin')
  return {
    ...real,
    getCategoriile: vi.fn(),
    getPreturilePeVarsta: vi.fn(),
    getPretulAdult: vi.fn(),
    getTabaraDeEditat: vi.fn(),
    getTaberelemele: vi.fn(),
    listeazaSabloaneTabara: vi.fn(),
    salveazaSablonTabara: vi.fn(),
    saveCampOffer: vi.fn(),
    stergeSablonTabara: vi.fn(),
  }
})
vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})
vi.mock('@/api/club', () => ({ getClubSelectableLocations: vi.fn() }))
vi.mock('@/api/coach', () => ({ getSelectableLocations: vi.fn() }))
vi.mock('@/api/camp-photos', () => ({
  schimbaPozaHero: vi.fn().mockResolvedValue('tabara-1/hero/a.jpg'),
}))
vi.mock('@/api/camp-rules-file', () => ({
  incarcaRegulamentFisier: vi.fn(),
  stergeRegulamentFisier: vi.fn(),
  campRulesFileAfisabil: vi.fn(() => null),
}))
vi.mock('../useProprietarTabere', () => ({
  useProprietarTabere: () => ({
    proprietar: { clubId: 'club-1', coachUserId: null },
    gata: true,
    eClub: true,
    eroare: false,
    reincearca: () => {},
  }),
}))
vi.mock('../CampPhotosSection', () => ({ default: () => null }))
vi.mock('../CampCoachesSection', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
