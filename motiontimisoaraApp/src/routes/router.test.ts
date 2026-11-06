import { afterEach, expect, test, vi } from 'vitest'

/**
 * Galeria de componente `/dev/ui` stătea ca rută publică, deasupra lui
 * `RequireAuth`. Verificat pe un build de producție servit înainte de reparație:
 * pagina randa „Galerie componente" oricui, fără sesiune.
 *
 * Testul se uită la tabela de rute, nu la ecran: ruta e construită la încărcarea
 * modulului din `import.meta.env.DEV`, deci singurul mod de a proba ambele
 * variante este să pornim modulul de două ori, cu variabila stubuită înainte.
 */
type Ruta = { path?: string; children?: Ruta[] }

function toateCaile(rute: Ruta[]): string[] {
  return rute.flatMap((r) => [...(r.path ? [r.path] : []), ...toateCaile(r.children ?? [])])
}

async function caileRouterului(): Promise<string[]> {
  vi.resetModules()
  const { router } = await import('./router')
  return toateCaile(router.routes as Ruta[])
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

/**
 * Fiecare caz reimportă întreaga tabelă de rute, deci tot graful de pagini, de
 * la zero. Sub suita completă, care rulează fișierele în paralel, asta trece
 * de pragul implicit de 5s — nu fiindcă testul ar aștepta ceva, ci fiindcă
 * chiar are de compilat atâta. Timeout-ul e dimensionat după muncă.
 */
const TIMEOUT_REIMPORT_MS = 30_000

test(
  'în dezvoltare galeria de componente e accesibilă',
  async () => {
    vi.stubEnv('DEV', true)
    const cai = await caileRouterului()
    expect(cai).toContain('/dev/ui')
    expect(cai).toContain('/dev/camp-form-draft')
  },
  TIMEOUT_REIMPORT_MS,
)

test(
  'pe build-ul de producție galeria de componente nu mai e o rută',
  async () => {
    vi.stubEnv('DEV', false)
    const cai = await caileRouterului()
    expect(cai).not.toContain('/dev/ui')
    expect(cai).not.toContain('/dev/camp-form-draft')
    expect(cai).toEqual(expect.arrayContaining(['/', '/cursuri', '/contact', '/login']))
  },
  TIMEOUT_REIMPORT_MS,
)

const PAGINI_PUBLICE_CU_TITLU = [
  '/cursuri',
  '/cursuri/:id',
  '/activitati',
  '/activitati/:id',
  '/tabere',
  '/tabere/:slug',
  '/concursuri',
  '/concursuri/:slug',
  '/antrenori',
  '/antrenori/:id',
  '/cluburi',
  '/cluburi/:id',
  '/harta',
  '/despre',
  '/contact',
  '/termeni',
  '/confidentialitate',
  '/stergere-cont',
  '/preturi',
  '/login',
  '/signup',
  '/register',
  '/register-coach',
  '/register-club',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '*',
]

type RutaCuTitlu = { path?: string; handle?: { pageTitle?: string }; children?: RutaCuTitlu[] }

function titluriPeCale(rute: RutaCuTitlu[]): Map<string, string | undefined> {
  const harta = new Map<string, string | undefined>()
  for (const r of rute) {
    if (r.path && !harta.has(r.path)) harta.set(r.path, r.handle?.pageTitle)
    for (const [cale, titlu] of titluriPeCale(r.children ?? [])) {
      if (!harta.has(cale)) harta.set(cale, titlu)
    }
  }
  return harta
}

test(
  'fiecare pagină publică are un titlu de tab propriu',
  async () => {
    vi.stubEnv('DEV', false)
    vi.resetModules()
    const { router } = await import('./router')
    const titluri = titluriPeCale(router.routes as RutaCuTitlu[])
    const fara = PAGINI_PUBLICE_CU_TITLU.filter((cale) => !titluri.get(cale))
    expect(fara).toEqual([])
    const unice = new Set(
      PAGINI_PUBLICE_CU_TITLU.filter((c) => !c.includes(':')).map((c) => titluri.get(c)),
    )
    expect(unice.size).toBe(PAGINI_PUBLICE_CU_TITLU.filter((c) => !c.includes(':')).length)
  },
  TIMEOUT_REIMPORT_MS,
)

test(
  'fiecare rută din panoul de administrare are titlu propriu de filă',
  async () => {
    vi.resetModules()
    const { router } = await import('./router')
    type RutaCuTitlu = Ruta & { handle?: { pageTitle?: string } }
    const adminRoutes: RutaCuTitlu[] = []
    const colecteaza = (rute: RutaCuTitlu[]) =>
      rute.forEach((r) => {
        if (r.path?.startsWith('/admin')) adminRoutes.push(r)
        colecteaza((r.children ?? []) as RutaCuTitlu[])
      })
    colecteaza(router.routes as RutaCuTitlu[])
    expect(adminRoutes.length).toBeGreaterThan(20)
    const fara = adminRoutes.filter((r) => !r.handle?.pageTitle).map((r) => r.path)
    expect(fara).toEqual([])
    const titluri = Object.fromEntries(adminRoutes.map((r) => [r.path, r.handle?.pageTitle]))
    expect(titluri['/admin/subscriptions']).toBe('Abonamente')
    expect(titluri['/admin/payments']).toBe('Plăți')
    expect(titluri['/admin/courses']).toBe('Cursuri')
  },
  TIMEOUT_REIMPORT_MS,
)
