import { Link } from 'react-router-dom'
import { Clock, Eye, MapPin, ShieldCheck } from 'lucide-react'

import { LegalPage, type LegalSection } from './legal/LegalPage'

const listClass = 'list-disc space-y-2 pl-5'
const linkClass =
  'text-primary underline underline-offset-4 focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'

const SECTIONS: LegalSection[] = [
  {
    id: 'ce-se-partajeaza',
    title: 'Ce se partajează',
    icon: MapPin,
    body: (
      <>
        <p>
          Antrenorul poate porni explicit partajarea poziției telefonului său pentru o ședință sau
          tabără. Funcția nu urmărește telefoanele copiilor și nu creează un istoric al deplasărilor
          lor. Se transmite periodic doar cea mai recentă poziție, precizia GPS și ora capturării.
        </p>
        <p>
          Pe telefon, partajarea poate continua cu aplicația în fundal, după acordarea permisiunii
          de localizare. Indicatorul sistemului și notificarea de pe Android arată când localizarea
          este activă. În browser, partajarea se oprește când fila devine inactivă.
        </p>
      </>
    ),
  },
  {
    id: 'cine-poate-vedea-pozitia',
    title: 'Cine poate vedea poziția',
    icon: Eye,
    body: (
      <>
        <p>
          Antrenorul ședinței și clubul proprietar au acces. Un părinte vede poziția doar după
          acordul său explicit și doar în condițiile de mai jos; accesul este verificat din nou la
          fiecare cerere.
        </p>
        <ul className={listClass}>
          <li>
            <strong>La cursuri:</strong> propriul copil este înscris activ și marcat prezent, cu
            scanare QR confirmată pentru aceeași ședință.
          </li>
          <li>
            <strong>În tabără:</strong> propriul copil este înscris activ, cu sosirea confirmată și
            fără plecare înregistrată. Prezența se confirmă o singură dată la sosire, fără scanări
            repetate la fiecare pornire. Partajarea o pornește antrenorul proprietar sau însoțitorul
            care a acceptat invitația. Locația activă apare în Anunțuri, fără a salva coordonate în
            anunțurile generale.
          </li>
          <li>
            <strong>Cum oprești:</strong> părintele poate apăsa „Retrage acordul”, iar antrenorul
            poate apăsa „Oprește locația” din orice ecran al aplicației. Repornirea unei partajări
            cere un acord nou al părintelui. O poziție deja văzută sau capturată de altă persoană nu
            poate fi retrasă de pe dispozitivul acelei persoane.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cat-timp-raman-datele',
    title: 'Cât timp rămân datele',
    icon: Clock,
    body: (
      <>
        <ul className={listClass}>
          <li>
            <strong>La cursuri</strong>, partajarea se încheie cel târziu la 15 minute după
            sfârșitul ședinței.
          </li>
          <li>
            <strong>În tabără</strong>, o pornire durează cel mult 8 ore și nu trece de încheierea
            taberei, după ora României.
          </li>
          <li>
            Antrenorul poate opri oricând și poate porni din nou explicit. Oprirea șterge imediat
            poziția din aplicație. La expirare, nimeni nu o mai poate vedea, iar poziția se șterge
            la următoarea curățare automată, care rulează în fiecare minut.
          </li>
        </ul>
        <p>
          Fiecare poziție nouă o înlocuiește pe cea veche: aplicația nu păstrează trasee și nu
          salvează poziții în istoricul copilului. Datele tehnice care împiedică trimiterea de două
          ori a aceleiași poziții se păstrează doar până la sfârșitul ședinței sau al taberei.
        </p>
        <p>
          Copiile de siguranță și jurnalele tehnice ale furnizorilor au propriile termene de
          păstrare, așa că ștergerea din aplicație nu le golește pe loc.
        </p>
      </>
    ),
  },
  {
    id: 'furnizori-si-control',
    title: 'Furnizori și control',
    icon: ShieldCheck,
    body: (
      <>
        <p>Folosim acești furnizori, fiecare doar pentru ce are nevoie:</p>
        <ul className={listClass}>
          <li>
            <strong>Supabase:</strong> contul, datele aplicației și actualizările live.
            Actualizările live nu conțin coordonate; infrastructura poate păstra temporar
            identificatorul canalului și ora evenimentului.
          </li>
          <li>
            <strong>Stripe:</strong> plățile cu cardul. Datele cardului ajung doar la Stripe.
          </li>
          <li>
            <strong>Google:</strong> conectarea cu contul Google, dacă o alegi, și notificările pe
            telefon (pe iPhone, livrate prin Apple).
          </li>
          <li>
            <strong>Netlify:</strong> găzduirea site-ului, care primește adresa IP la fiecare
            vizită.
          </li>
          <li>
            <strong>CARTO, OpenStreetMap și Photon:</strong> harta și căutarea adreselor. Încărcarea
            hărții le transmite adresa IP și zona de hartă cerută; căutarea le transmite textul
            căutat.
          </li>
        </ul>
        <p>
          Poți refuza ori retrage permisiunea de localizare din setările telefonului. Fără ea,
          antrenorul poate folosi celelalte funcții ale aplicației. Pentru întrebări despre datele
          tale, folosește{' '}
          <Link className={linkClass} to="/contact">
            pagina de contact
          </Link>{' '}
          sau discută cu clubul care organizează ședința.
        </p>
      </>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Confidențialitate"
      intro="Ce date folosește Motion Timișoara, cine le vede și cât timp le păstrăm, începând cu funcția „Locația antrenorului”."
      version="1.0"
      updated="22 octombrie 2026"
      sections={SECTIONS}
    />
  )
}
