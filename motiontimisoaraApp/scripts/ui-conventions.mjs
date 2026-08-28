/**
 * Convențiile UI ale aplicației, MĂSURATE din cod.
 *
 * De ce există: până acum, convențiile trăiau în capul sesiunii care scria
 * criteriile unei secțiuni. Fiecare secțiune nouă le re-deriva din discuție,
 * iar cele deja decise („eroarea nu arată ca listă goală") se pierdeau între
 * pagini. Documentul scris de mână nu e o soluție — `TriathlonTeamFE/UIGuidelines.md`
 * a rămas în urmă tocmai fiindcă era scris de mână.
 *
 * Regula acestui fișier: o convenție intră aici numai dacă poate fi MĂSURATĂ.
 * Ce cere o alegere (unde trăiește un token, ce valoare are) nu e o convenție
 * încă — e un item de lucru. Nimic din ce urmează nu e o opinie.
 *
 * Ieșirea e deterministă (fără dată, fără SHA), ca `src/ui-conventions.test.ts`
 * să poată cere ca `docs/ui-conventions.md` să fie exact ce măsoară codul azi.
 *
 * Rulează:  npm run conventions
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Rădăcina aplicației (motiontimisoaraApp/), nu a repo-ului. */
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const IESIRE = join(APP, 'docs', 'ui-conventions.md')

const IGNORATE = new Set(['node_modules', 'dist', 'dist-ssr', '.git', 'android', 'ios', 'coverage'])

/** Toate fișierele dintr-un subarbore, ca căi relative la APP, cu `/` pe orice sistem. */
function fisiere(subdir, extensii) {
  const radacina = join(APP, subdir)
  const gasite = []
  const coada = [radacina]
  while (coada.length) {
    const acum = coada.pop()
    let intrari
    try {
      intrari = readdirSync(acum)
    } catch {
      continue
    }
    for (const nume of intrari) {
      if (IGNORATE.has(nume)) continue
      const cale = join(acum, nume)
      if (statSync(cale).isDirectory()) {
        coada.push(cale)
        continue
      }
      if (extensii.some((e) => nume.endsWith(e))) {
        gasite.push(relative(APP, cale).split('\\').join('/'))
      }
    }
  }
  return gasite.sort()
}

const citeste = (cale) => readFileSync(join(APP, cale), 'utf8')

/** „1 fișier" / „2 fișiere" — fișierul e citit și de oameni. */
const nrDe = (n, unul, mai_multe) => `${n} ${n === 1 ? unul : mai_multe}`

/* ------------------------------------------------------------------ *
 * 1. Stare de eroare ≠ listă goală
 * ------------------------------------------------------------------ */

/**
 * Ecranele care încarcă date fără nicio ramură de eroare.
 *
 * „Are ramură de eroare" înseamnă că measure-ul vede `isError` sau `error`
 * venind CHIAR din useQuery — fie destructurat, fie citit de pe rezultat.
 * `toast.error(...)` dintr-o mutație nu se pune: nu spune nimic despre ce
 * vede omul când citirea eșuează.
 */
export function ecraneFaraRamuraDeEroare() {
  return fisiere('src/features', ['.tsx'])
    .filter((f) => !f.endsWith('.test.tsx'))
    .filter((f) => citeste(f).includes('useQuery('))
    .filter((f) => !trateazaEroareaDeCitire(citeste(f)))
}

/** Exportată separat ca testul s-o poată rula pe text, nu doar pe disc. */
export function trateazaEroareaDeCitire(sursa) {
  // const { data, isError } = useQuery({...})
  const destructurari = sursa.matchAll(/const\s*\{([^}]*)\}\s*=\s*useQuery\b/g)
  for (const potrivire of destructurari) {
    if (/\bisError\b|\berror\b/.test(potrivire[1])) return true
  }
  // const q = useQuery({...})  ... q.isError
  const legari = sursa.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*useQuery\b/g)
  for (const potrivire of legari) {
    const nume = potrivire[1].replace(/[$]/g, '\\$&')
    if (new RegExp(`\\b${nume}\\.(isError|error)\\b`).test(sursa)) return true
  }
  return false
}

/** Câte ecrane încarcă date, cu tot cu cele care tratează eroarea. */
export function ecraneCareIncarcaDate() {
  return fisiere('src/features', ['.tsx'])
    .filter((f) => !f.endsWith('.test.tsx'))
    .filter((f) => citeste(f).includes('useQuery('))
}

/* ------------------------------------------------------------------ *
 * 2. Țintă tactilă
 * ------------------------------------------------------------------ */

/** Valorile de țintă tactilă scrise direct în componente, fără token. */
export function tinteTactileScriseDeMana() {
  const gasite = []
  for (const f of fisiere('src', ['.tsx'])) {
    if (f.endsWith('.test.tsx')) continue
    const potriviri = citeste(f).match(/\bmin-h-11\b|\bmin-w-11\b|\bmin-h-\[44px\]\b|\bmin-w-\[44px\]\b/g)
    if (potriviri) gasite.push({ fisier: f, cate: potriviri.length })
  }
  return gasite
}

/** Există un token de țintă tactilă în foaia de tokeni? (azi: nu) */
export function tokenDeTintaTactila() {
  const css = citeste('src/index.css')
  const potrivire = css.match(/^\s*(--(?:target|tap|touch|hit)[\w-]*)\s*:/m)
  return potrivire ? potrivire[1] : null
}

/* ------------------------------------------------------------------ *
 * 3. Forme de așteptare
 * ------------------------------------------------------------------ */

const SCHELET_CANONIC = 'src/components/ui/skeleton.tsx'

/** Copii locale ale scheletului — orice `animate-pulse` în afara primitivei. */
export function copiiLocaleDeSchelet() {
  return fisiere('src', ['.tsx', '.ts', '.css'])
    .filter((f) => f !== SCHELET_CANONIC && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'))
    .filter((f) => citeste(f).includes('animate-pulse'))
}

/** Câte fișiere folosesc scheletul canonic. */
export function consumatoriDeSchelet() {
  return fisiere('src', ['.tsx']).filter((f) => /components\/ui\/skeleton|\bSkeleton\b/.test(citeste(f)) && f !== SCHELET_CANONIC)
}

/* ------------------------------------------------------------------ *
 * 4. Culorile de brand
 * ------------------------------------------------------------------ */

/**
 * Excepțiile de la „nicio culoare literală", cu motivul lor.
 *
 * O convenție fără excepțiile ei scrise e o convenție subspecificată: fie
 * următorul „repară" logoul Google și îl face fals, fie învață să ignore
 * cifra. Amândouă sunt mai rele decât un rând în plus aici.
 */
export const EXCEPTII_HEX = {
  'src/features/auth/GoogleSignInButton.tsx': 'culorile oficiale ale logoului Google — marca altcuiva, nu se tokenizează',
}

/** Literale hex rămase în componente (tokenii trăiesc în index.css), fără excepții. */
export function literaleHexInComponente() {
  const gasite = []
  for (const f of fisiere('src', ['.tsx'])) {
    if (f.endsWith('.test.tsx')) continue
    if (f in EXCEPTII_HEX) continue
    const potriviri = citeste(f).match(/#[0-9a-fA-F]{6}\b/g)
    if (potriviri) gasite.push({ fisier: f, cate: potriviri.length })
  }
  return gasite
}

/* ------------------------------------------------------------------ *
 * 5. Contrast pe culoare de brand
 * ------------------------------------------------------------------ */

/** Tokenii de culoare din blocul :root al foii de tokeni. */
export function tokeniDeCuloare() {
  const css = citeste('src/index.css')
  const inceput = css.indexOf(':root {')
  const sfarsit = css.indexOf('}', inceput)
  const bloc = css.slice(inceput, sfarsit)
  const tokeni = {}
  for (const potrivire of bloc.matchAll(/^\s*(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    tokeni[potrivire[1]] = potrivire[2].toLowerCase()
  }
  return tokeni
}

function luminanta(hex) {
  const canale = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canale.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Raportul de contrast WCAG între două culori hex. */
export function raportContrast(a, b) {
  const la = luminanta(a)
  const lb = luminanta(b)
  const [sus, jos] = la > lb ? [la, lb] : [lb, la]
  return (sus + 0.05) / (jos + 0.05)
}

/**
 * Perechile fundal/cerneală declarate ca tokeni, cu raportul lor.
 * Fixează reparația din 2026-08: badge-urile COACH și ADMIN erau la 2,28:1
 * și 2,15:1 cu text alb. Culorile au rămas vii, s-a închis cerneala.
 */
export function contrastePeCuloriDeBrand() {
  const tokeni = tokeniDeCuloare()
  const perechi = []
  for (const [nume, valoare] of Object.entries(tokeni)) {
    const cerneala = tokeni[`${nume}-foreground`]
    if (!cerneala) continue
    perechi.push({
      pereche: `${nume} / ${nume}-foreground`,
      fundal: valoare,
      cerneala,
      raport: Math.round(raportContrast(valoare, cerneala) * 100) / 100,
    })
  }
  return perechi.sort((a, b) => a.pereche.localeCompare(b.pereche))
}

/* ------------------------------------------------------------------ *
 * 6. Fus orar la „încheiat"
 * ------------------------------------------------------------------ */

const COLOANE_DE_DATA = ['period_end', 'period_start', 'start_date', 'end_date', 'occurrence_date']

/**
 * Filtre de dată împinse în interogare.
 *
 * `gte`/`lte` pe o coloană de dată taie la miezul nopții UTC, deci ascunde
 * un rând cu o zi mai devreme pentru cine e la vest de Greenwich. Decizia
 * „s-a încheiat" se ia în fusul cititorului, în JS — vezi sAIncheiat().
 */
export function filtreDeDataInInterogari() {
  const gasite = []
  for (const f of fisiere('src/api', ['.ts'])) {
    if (f.endsWith('.test.ts')) continue
    const sursa = citeste(f)
    for (const potrivire of sursa.matchAll(/\.(gte|lte|gt|lt)\(\s*['"]([\w]+)['"]/g)) {
      if (COLOANE_DE_DATA.includes(potrivire[2])) {
        gasite.push({ fisier: f, filtru: `${potrivire[1]}('${potrivire[2]}')` })
      }
    }
  }
  return gasite
}

/** Unde se folosește decizia canonică de „încheiat". */
export function consumatoriDeSAIncheiat() {
  return fisiere('src', ['.ts', '.tsx']).filter(
    (f) => f !== 'src/api/camps.ts' && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx') && citeste(f).includes('sAIncheiat')
  )
}

/* ------------------------------------------------------------------ *
 * Randarea
 * ------------------------------------------------------------------ */

const RESPECTATA = 'RESPECTATĂ'
const DERIVA = 'DERIVĂ'
const FARA_CANONIC = 'FĂRĂ CANONIC'

export function masoaraTot() {
  const oarbe = ecraneFaraRamuraDeEroare()
  const total = ecraneCareIncarcaDate()
  const tinte = tinteTactileScriseDeMana()
  const cateTinte = tinte.reduce((s, t) => s + t.cate, 0)
  const token = tokenDeTintaTactila()
  const copii = copiiLocaleDeSchelet()
  const hex = literaleHexInComponente()
  const cateHex = hex.reduce((s, h) => s + h.cate, 0)
  const contraste = contrastePeCuloriDeBrand()
  const filtre = filtreDeDataInInterogari()

  return [
    {
      nume: 'Stare de eroare ≠ listă goală',
      stare: oarbe.length === 0 ? RESPECTATA : DERIVA,
      insemn: oarbe.length === 0 ? '' : `${oarbe.length}/${total.length}`,
      regula: [
        'Orice ecran care încarcă date are trei ieșiri distincte: așteptare,',
        'eroare cu reîncercare, gol. Nu cad una peste alta — o listă goală',
        'nu poate fi cum arată o rețea căzută.',
      ],
      randuri: [
        ['canonic', 'src/features/camps/CampsListPage.tsx'],
        ['plafon', `${oarbe.length} ecrane fără ramură de eroare, din ${total.length} — poate doar scădea`],
      ],
    },
    {
      nume: 'Țintă tactilă',
      stare: token ? RESPECTATA : FARA_CANONIC,
      insemn: '',
      regula: [
        'Niciun control sub ținta comună; se urmează tokenul, nu numărul.',
        'Cât timp tokenul nu există, asta NU e o convenție — e un item de lucru.',
      ],
      randuri: [
        ['canonic', token ? `src/index.css ${token}` : '— lipsește —'],
        ['măsurat', `${nrDe(cateTinte, 'valoare scrisă', 'valori scrise')} de mână, în ${nrDe(tinte.length, 'fișier', 'fișiere')}`],
        ['→', 'unde trăiește tokenul e o alegere, nu o măsurătoare. Deschis pe Focus.'],
      ],
    },
    {
      nume: 'Forme de așteptare',
      stare: copii.length === 0 ? RESPECTATA : DERIVA,
      insemn: copii.length === 0 ? '' : `${copii.length}`,
      regula: [
        'Scheletul oglindește structura pe care o promite; nu se scrie local.',
      ],
      randuri: [
        ['canonic', SCHELET_CANONIC],
        ['blocat', `${copii.length} animate-pulse în afara primitivei`],
        ['folosit', nrDe(consumatoriDeSchelet().length, 'fișier', 'fișiere')],
      ],
    },
    {
      nume: 'Culorile de brand',
      stare: cateHex === 0 ? RESPECTATA : DERIVA,
      insemn: cateHex === 0 ? '' : `${cateHex}`,
      regula: [
        'Nicio culoare literală în componente; totul prin tokeni, ambele teme.',
      ],
      randuri: [
        ['canonic', 'src/index.css :root + .dark'],
        ['plafon', `${nrDe(cateHex, 'literal hex rămas', 'literale hex rămase')}, în ${nrDe(hex.length, 'fișier', 'fișiere')} — poate doar scădea`],
        ...hex.map((h) => ['', `${h.fisier} (${h.cate})`]),
        ...Object.entries(EXCEPTII_HEX).map(([f, motiv]) => ['excepție', `${f} — ${motiv}`]),
      ],
    },
    {
      nume: 'Contrast pe perechile de tokeni',
      stare: contraste.every((c) => c.raport >= 4.5) ? RESPECTATA : DERIVA,
      insemn: '',
      regula: [
        'Orice pereche <token> / <token>-foreground trece pragul AA: ≥ 4,5:1.',
        'Când o pereche cade, culoarea rămâne vie și se închide cerneala — aceleași',
        'culori sunt folosite și ca text pe fundal închis, deci închiderea lor le stinge.',
      ],
      randuri: [
        ['canonic', 'src/index.css — perechile <token> / <token>-foreground'],
        ...contraste.map((c) => ['', `${c.pereche} — ${c.raport.toFixed(2)}:1`]),
      ],
    },
    {
      nume: 'Fus orar la „încheiat"',
      stare: filtre.length === 0 ? RESPECTATA : DERIVA,
      insemn: filtre.length === 0 ? '' : `${filtre.length}`,
      regula: [
        'Sfârșitul zilei în fusul CITITORULUI, filtrat în JS. Niciodată gte/lte pe',
        'o coloană de dată în interogare — taie după miezul nopții UTC și ascunde',
        'un rând cu o zi mai devreme pentru cine e la vest de Greenwich.',
      ],
      randuri: [
        ['canonic', 'src/api/camps.ts sAIncheiat()'],
        ['blocat', `${filtre.length} filtre de dată în interogări`],
        ['folosit', nrDe(consumatoriDeSAIncheiat().length, 'fișier', 'fișiere')],
      ],
    },
  ]
}

export function randeaza(masuratori) {
  const respectate = masuratori.filter((m) => m.stare === RESPECTATA).length
  const derive = masuratori.filter((m) => m.stare === DERIVA).length
  const fara = masuratori.filter((m) => m.stare === FARA_CANONIC).length

  const linii = [
    '# Convenții UI — motiontimisoaraApp',
    '',
    '<!-- GENERAT de scripts/ui-conventions.mjs. Nu edita de mână: `npm run conventions`',
    '     îl rescrie, iar src/ui-conventions.test.ts se înroșește dacă cifrele de aici',
    '     nu sunt cele măsurate din cod. -->',
    '',
    'Citește-l înainte de a scrie criteriile unei secțiuni noi: ce e mai jos se',
    'moștenește, nu se re-decide. Ce nu e mai jos e chiar nou și merită o întrebare.',
    '',
    `${masuratori.length} convenții · ${respectate} respectate · ${derive} în derivă · ${fara} fără canonic`,
    '',
  ]

  for (const m of masuratori) {
    const insemn = m.insemn ? `${m.stare} ${m.insemn}` : m.stare
    linii.push(`## ${m.nume}  [${insemn}]`, '')
    for (const rand of m.regula) linii.push(`    ${rand}`)
    linii.push('')
    const latime = Math.max(...m.randuri.map(([eticheta]) => eticheta.length))
    for (const [eticheta, valoare] of m.randuri) {
      linii.push(`    ${eticheta.padEnd(latime)}  ${valoare}`)
    }
    linii.push('')
  }

  return linii.join('\n')
}

/** Textul pe care fișierul generat TREBUIE să-l aibă, măsurat acum. */
export function textulAsteptat() {
  return randeaza(masoaraTot())
}

export function caleaFisierului() {
  return IESIRE
}

/**
 * Ce scrie ACUM în docs/ui-conventions.md. Gol dacă lipsește.
 *
 * Terminațiile se normalizează la LF: `core.autocrlf` scoate fișierul cu CRLF
 * pe Windows la checkout, iar generatorul scrie LF. Fără normalizare, testul de
 * prospețime ar fi roșu pe orice clonă proaspătă de Windows — adică ar raporta
 * o derivă care nu există, și ar fi ignorat în două zile.
 */
export function textulDePeDisc() {
  try {
    return readFileSync(IESIRE, 'utf8').split('\r\n').join('\n')
  } catch {
    return ''
  }
}

/**
 * Pointerii „canonic" care nu se rezolvă pe disc.
 *
 * Regula fără de care tot fișierul e decor: o convenție care arată spre un
 * fișier mutat sau șters nu e o convenție slăbită, e una care minte. Aici
 * cade zgomotos, nu tăcut.
 */
export function pointeriCareNuSeRezolva() {
  const lipsa = []
  for (const masuratoare of masoaraTot()) {
    for (const [eticheta, valoare] of masuratoare.randuri) {
      if (eticheta !== 'canonic') continue
      const cale = valoare.split(' ')[0]
      if (!cale.startsWith('src/')) continue // „— lipsește —" nu e un pointer
      if (!existsSync(join(APP, cale))) lipsa.push({ conventie: masuratoare.nume, cale })
    }
  }
  return lipsa
}

const rulatDirect = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (rulatDirect) {
  const text = textulAsteptat()
  mkdirSync(dirname(IESIRE), { recursive: true })
  writeFileSync(IESIRE, text, 'utf8')
  process.stdout.write(`${relative(APP, IESIRE).split('\\').join('/')} — ${text.split('\n').length} linii\n`)
}
