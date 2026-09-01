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
    expect(await caileRouterului()).toContain('/dev/ui')
  },
  TIMEOUT_REIMPORT_MS,
)

test(
  'pe build-ul de producție galeria de componente nu mai e o rută',
  async () => {
    vi.stubEnv('DEV', false)
    const cai = await caileRouterului()
    expect(cai).not.toContain('/dev/ui')
    // Restul tabelei rămâne neatinsă — nu am scos rute publice din greșeală.
    expect(cai).toEqual(expect.arrayContaining(['/', '/cursuri', '/contact', '/login']))
  },
  TIMEOUT_REIMPORT_MS,
)
