export type PricingPlan = {
  code: 'COACH' | 'CLUB_START' | 'CLUB' | 'CLUB_PRO'
  name: string
  audience: string
  priceBani: number
  coaches: string
  features: string[]
}

export const COACH_PLAN: PricingPlan = {
  code: 'COACH',
  name: 'Antrenor',
  audience: 'Pentru antrenorii independenți',
  priceBani: 10000,
  coaches: 'Doar tu',
  features: [
    'Profilul tău apare la Antrenori',
    'Ofertele tale proprii apar în căutare și pe hartă',
    'Primești înscrieri, cu plata cu cardul sau cash',
    'Prezență, anunțuri și locația live pentru părinți',
  ],
}

export const CLUB_PLANS: PricingPlan[] = [
  {
    code: 'CLUB_START',
    name: 'Club Start',
    audience: 'Pentru cluburile mici',
    priceBani: 19900,
    coaches: 'Până la 3 antrenori',
    features: [],
  },
  {
    code: 'CLUB',
    name: 'Club',
    audience: 'Pentru cluburile în creștere',
    priceBani: 34900,
    coaches: 'Până la 10 antrenori',
    features: [],
  },
  {
    code: 'CLUB_PRO',
    name: 'Club Pro',
    audience: 'Pentru cluburile mari',
    priceBani: 59900,
    coaches: 'Antrenori nelimitați',
    features: [],
  },
]

export const CLUB_FEATURES = [
  'Clubul apare la Cluburi, cu toate ofertele lui',
  'Antrenorii clubului sunt incluși, fără abonament separat',
  'Primești înscrieri, cu plata cu cardul sau cash',
  'Prezență, anunțuri și locația live pentru părinți',
]

export const PROMO = {
  title: '3 luni gratuite la lansare',
  text: 'Conturile create înainte de lansarea abonamentelor primesc 3 luni gratuite, numărate de la lansare. După lansare, fiecare cont nou are 30 de zile gratuite. Nu îți cerem cardul în perioada gratuită.',
}

export const PRICE_NOTE =
  'Prețurile sunt finale, în lei, fără TVA: operatorul platformei, TITUS CLUB SWIM&FUN S.R.L., nu este plătitor de TVA. Abonamentul se plătește lunar, cu cardul, pe site, și se reînnoiește automat.'

export type PricingFaqItem = { question: string; answer: string }

export const PRICING_FAQ: PricingFaqItem[] = [
  {
    question: 'Părinții plătesc abonament?',
    answer:
      'Nu. Abonamentul este doar pentru antrenori și cluburi. Părinții plătesc, ca până acum, cursurile, taberele și activitățile la care își înscriu copiii.',
  },
  {
    question: 'Antrenorii unui club plătesc separat?',
    answer:
      'Nu. Ofertele clubului sunt acoperite de abonamentul clubului. Un antrenor plătește 100 lei pe lună doar dacă publică și oferte proprii, în afara clubului.',
  },
  {
    question: 'Cum anulez abonamentul?',
    answer:
      'Oricând, din contul tău, pe site. Abonamentul rămâne activ până la sfârșitul lunii deja plătite și nu se mai reînnoiește.',
  },
  {
    question: 'Ce se întâmplă când abonamentul expiră?',
    answer:
      'Profilul și ofertele tale nu mai apar pe site și nu mai primesc înscrieri noi. Înscrierile existente, plățile lor, prezența și anunțurile continuă. Nu ștergem nimic: când plătești din nou, totul reapare imediat.',
  },
  {
    question: 'Ce se întâmplă dacă plata lunară nu trece?',
    answer:
      'Reîncercăm plata și îți păstrăm profilul vizibil încă 7 zile, timp în care poți actualiza cardul.',
  },
  {
    question: 'Pot schimba pachetul clubului?',
    answer:
      'Da, din pagina clubului. Treci imediat la un pachet mai mare și plătești doar diferența. Un pachet mai mic intră de la luna următoare, dacă numărul antrenorilor clubului încape în noua limită.',
  },
]

const wholeLei = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })

export function formatPlanPrice(priceBani: number): string {
  return wholeLei.format(Math.round(priceBani / 100))
}
