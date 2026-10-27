import { Link } from 'react-router-dom'
import { Archive, Baby, Building2, Database, Scale, ShieldCheck, UserCheck } from 'lucide-react'

import type { LegalSection } from '../legal/LegalPage'
import { PRIVACY_EMAIL } from '../legal/operator'
import { OperatorDetails } from './OperatorDetails'
import { linkClass, listClass } from './privacy-styles'

export const GDPR_SECTIONS: LegalSection[] = [
  {
    id: 'operator',
    surfaceKey: 'manual:section:cine-raspunde-de-datele-tale:5fc8f60c-8192-400e-b205-9db26f2fb0c2',
    title: 'Cine răspunde de datele tale',
    icon: Building2,
    body: (
      <>
        <p>
          Operatorul datelor din contul tău, din înscrieri și din plăți este firma care
          administrează Motion România:
        </p>
        <OperatorDetails />
        <p>
          Clubul sau antrenorul care organizează cursul, activitatea ori tabăra decide ce date îi
          trebuie pentru ea, de exemplu fișa de sănătate în tabără, și răspunde de felul în care le
          folosește acolo.
        </p>
      </>
    ),
  },
  {
    id: 'date-colectate',
    surfaceKey: 'manual:section:ce-date-colectam:4a5d3f5e-7ddf-48ca-880b-a4a2ef696842',
    title: 'Ce date colectăm',
    icon: Database,
    body: (
      <ul className={listClass}>
        <li>
          <strong>Contul tău:</strong> nume, email, telefon, rolul (părinte, club, antrenor) și,
          dacă alegi, conectarea cu Google.
        </li>
        <li>
          <strong>Copiii:</strong> nume, data nașterii, nivel, mărime tricou, persoane de contact
          pentru urgențe, cine poate ridica copilul, poza și acordul foto. Opțional, date de
          sănătate: alergii, observații medicale, restricții alimentare și dacă știe să înoate.
        </li>
        <li>
          <strong>Înscrieri și prezență:</strong> la ce e înscris copilul, ședințele folosite,
          prezența, scanările codului QR și sosirea sau plecarea din tabără.
        </li>
        <li>
          <strong>Plăți:</strong> suma, metoda, starea plății și datele de facturare (nume, email,
          adresă). Datele cardului ajung doar la Stripe, nu la noi.
        </li>
        <li>
          <strong>Cluburi și antrenori:</strong> profilul public, datele firmei, contul bancar
          pentru încasări și locațiile.
        </li>
        <li>
          <strong>Mesaje și recenzii:</strong> ce trimiți prin formularul de contact, anunțurile și
          notele sau comentariile lăsate antrenorilor și cursurilor.
        </li>
        <li>
          <strong>Date tehnice:</strong> adresa IP la vizitarea site-ului, identificatorul
          telefonului pentru notificări și jurnalele de securitate.
        </li>
      </ul>
    ),
  },
  {
    id: 'scop-si-temei',
    surfaceKey:
      'manual:section:de-ce-le-folosim-si-pe-ce-temei:8b18dfc5-abf3-4a95-b34f-48db10699f07',
    title: 'De ce le folosim și pe ce temei',
    icon: Scale,
    body: (
      <ul className={listClass}>
        <li>
          <strong>Cont, înscriere și prezență:</strong> ca să-ți oferim serviciul pe care l-ai cerut
          (contract, art. 6 alin. 1 lit. b din GDPR).
        </li>
        <li>
          <strong>Plăți și facturi:</strong> pentru încasare (contract) și pentru evidența cerută de
          legea contabilă și fiscală (obligație legală, art. 6 alin. 1 lit. c).
        </li>
        <li>
          <strong>Datele de sănătate ale copilului:</strong> ca organizatorul să-l țină în
          siguranță, doar cu acordul explicit al părintelui (art. 9 alin. 2 lit. a). Într-o urgență
          medicală le poate transmite medicilor (interese vitale, art. 9 alin. 2 lit. c).
        </li>
        <li>
          <strong>Poze și filmări cu copilul:</strong> doar cu acordul foto dat în profilul
          copilului (consimțământ, art. 6 alin. 1 lit. a). Refuzul nu afectează înscrierea.
        </li>
        <li>
          <strong>Notificări pe telefon:</strong> doar după ce le permiți din aplicație și din
          setările telefonului.
        </li>
        <li>
          <strong>Securitate și prevenirea abuzurilor:</strong> jurnale tehnice și verificări de
          acces (interes legitim, art. 6 alin. 1 lit. f).
        </li>
      </ul>
    ),
  },
  {
    id: 'datele-copiilor',
    surfaceKey: 'manual:section:datele-copiilor:1520e5fc-5335-4ff8-b47b-9479894f0d44',
    title: 'Datele copiilor',
    icon: Baby,
    body: (
      <>
        <p>
          Copiii nu își fac cont. Părintele creează profilul copilului, completează datele și dă
          acordurile în numele lui; un copil sub 16 ani nu poate consimți singur la servicii online
          (art. 8 din GDPR și Legea 190/2018).
        </p>
        <ul className={listClass}>
          <li>
            Datele de sănătate sunt opționale. Completează doar ce trebuie să știe organizatorul.
          </li>
          <li>
            Profilul copilului îl văd părintele, clubul și antrenorul ofertelor la care e înscris,
            plus administratorii platformei pentru suport.
          </li>
          <li>
            Acordul foto îl poți schimba oricând din profilul copilului; retragerea nu afectează ce
            s-a publicat legal înainte de ea.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'furnizori-si-control',
    surfaceKey: 'manual:section:furnizori-si-control:aed33303-6848-4493-aaa5-e80de40b862e',
    title: 'Cui transmitem datele',
    icon: ShieldCheck,
    body: (
      <>
        <p>Folosim acești furnizori, fiecare doar pentru ce are nevoie să facă pentru noi:</p>
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
          Clubul sau antrenorul la care înscrii copilul primește datele înscrierii și ale copilului
          de care are nevoie la activitate. Administratorii platformei le văd doar pentru suport și
          siguranță. Nu vindem date și nu le folosim pentru reclame.
        </p>
        <p>
          Unii furnizori pot prelucra date în afara Uniunii Europene, de exemplu în SUA. Atunci
          transferul se face cu garanțiile cerute de GDPR: decizia de adecvare pentru cadrul UE–SUA
          privind protecția datelor sau clauzele contractuale standard ale Comisiei Europene.
        </p>
      </>
    ),
  },
  {
    id: 'durata-pastrarii',
    surfaceKey: 'manual:section:cat-timp-pastram-datele:badb15fa-bf1e-4d70-a0ef-e0b6b74f01b3',
    title: 'Cât timp păstrăm datele',
    icon: Archive,
    body: (
      <>
        <ul className={listClass}>
          <li>
            <strong>Contul și profilurile copiilor:</strong> cât timp ai cont. Un profil de copil îl
            poți șterge oricând din cont; pentru ștergerea contului scrie-ne.
          </li>
          <li>
            <strong>Înscrieri și prezență:</strong> cât timp ai cont, ca să vezi istoricul și
            ședințele rămase.
          </li>
          <li>
            <strong>Plăți și facturi:</strong> cât cere legislația contabilă și fiscală, chiar dacă
            ștergi contul.
          </li>
          <li>
            <strong>Fișierele temporare din anunțuri:</strong> se șterg automat la expirarea lor.
          </li>
        </ul>
        <p>
          Copiile de siguranță ale furnizorilor se rotesc după termenele lor, așa că o ștergere
          ajunge în ele cu întârziere.
        </p>
      </>
    ),
  },
  {
    id: 'drepturile-tale',
    surfaceKey: 'manual:section:drepturile-tale:c1523f4b-9f6e-4b58-8cd2-c7c65a851030',
    title: 'Drepturile tale',
    icon: UserCheck,
    body: (
      <>
        <p>
          Ai dreptul să afli ce date avem despre tine și copiii tăi, să le corectezi, să ceri
          ștergerea sau restricționarea lor, să le primești într-un format portabil, să te opui
          prelucrării bazate pe interes legitim și să retragi oricând un acord dat. Retragerea nu
          afectează ce s-a făcut legal înainte de ea. Nu luăm decizii automate care să aibă efecte
          juridice asupra ta.
        </p>
        <p>
          Scrie-ne la{' '}
          <a className={linkClass} href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>{' '}
          sau prin{' '}
          <Link className={linkClass} to="/contact">
            pagina de contact
          </Link>
          . Îți răspundem în cel mult o lună.
        </p>
        <p>
          Dacă nu ești mulțumit de răspuns, poți depune o plângere la Autoritatea Națională de
          Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), B-dul G-ral. Gheorghe
          Magheru 28-30, sector 1, București,{' '}
          <a
            className={linkClass}
            href="https://www.dataprotection.ro"
            target="_blank"
            rel="noreferrer"
          >
            dataprotection.ro
          </a>
          .
        </p>
      </>
    ),
  },
]
