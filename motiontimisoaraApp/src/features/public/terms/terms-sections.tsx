import { Link } from 'react-router-dom'
import { CreditCard, Lock, Mail, MessageSquare, Phone, ShieldCheck } from 'lucide-react'

import type { LegalSection } from '../legal/LegalPage'

export const TERMS_VERSION = '1.1'
export const TERMS_UPDATED = '27 octombrie 2026'

const linkClass = 'text-primary underline underline-offset-4'
const rowClass =
  'hover:text-primary min-h-touch-target flex w-fit items-center gap-3 rounded-xl underline-offset-4 transition-colors hover:underline'

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'inscrieri-si-plati',
    surfaceKey: 'manual:section:inscrieri-si-plati:6373696a-000f-4366-8199-242fc832980c',
    icon: CreditCard,
    title: 'Înscrieri și plăți',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Înainte de plată vezi organizatorul, perioada, prețul total în lei și regulamentul
          ofertei, dacă organizatorul l-a adăugat.
        </li>
        <li>
          Plătești online cu cardul, prin Stripe, sau numerar la organizator, când oferta permite.
          Suma afișată la finalizare este suma finală.
        </li>
        <li>
          Înscrierea devine activă după confirmarea plății online sau, la numerar, după ce
          organizatorul o confirmă. O vezi în contul tău.
        </li>
        <li>
          Taberele și activitățile cu dată fixă nu au drept de retragere de 14 zile (OUG 34/2014,
          art. 16 lit. l). Anularea și rambursarea urmează regulamentul ofertei.
        </li>
        <li>Dacă organizatorul anulează oferta, primești banii înapoi integral.</li>
      </ul>
    ),
  },
  {
    id: 'participare-in-siguranta',
    surfaceKey: 'manual:section:participare-in-siguranta:5f3b78a1-d5c6-46f4-855b-3b76e392b5e9',
    icon: ShieldCheck,
    title: 'Participare în siguranță',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Cine înscrie un copil confirmă că este părintele sau reprezentantul lui legal.</li>
        <li>
          Datele despre copil trebuie să fie corecte: vârsta, alergiile și problemele de sănătate
          care contează pentru efort.
        </li>
        <li>
          Respecți regulamentul organizatorului: programul, echipamentul, predarea și preluarea
          copilului.
        </li>
        <li>
          La tabere, organizatorul cere la sosire avizul epidemiologic de la medicul de familie,
          emis cu cel mult 24 de ore înainte de plecare (72 de ore dacă plecarea e lunea sau după o
          sărbătoare).
        </li>
        <li>
          Organizatorul răspunde de supravegherea copilului și de siguranța activității. Informarea
          despre riscuri nu îl scutește de această răspundere.
        </li>
      </ul>
    ),
  },
  {
    id: 'date-personale',
    surfaceKey: 'manual:section:date-personale:32b69216-f95c-45c7-9b69-c3646e870164',
    icon: Lock,
    title: 'Date personale',
    body: (
      <>
        <p>
          Folosim doar datele necesare contului, înscrierilor și plăților: numele, datele de contact
          și datele copiilor pe care îi înscrii. Organizatorul vede doar copiii înscriși la oferta
          lui. Datele cardului sunt procesate de Stripe; noi nu le vedem.
        </p>
        <p>
          La fiecare înscriere păstrăm dovada că ai acceptat acești termeni și regulamentul ofertei:
          contul tău, versiunea termenilor, data și ora.
        </p>
        <p>
          Detaliile despre date sunt în{' '}
          <Link className={linkClass} to="/confidentialitate">
            politica de confidențialitate
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    surfaceKey: 'manual:section:contact:0661474a-434f-46e9-84cd-29bc8015e623',
    icon: MessageSquare,
    title: 'Contact',
    body: (
      <>
        <p>Pentru întrebări despre o înscriere sau despre acești termeni:</p>
        <div className="space-y-1 text-sm">
          <a href="mailto:contact@motionromania.com" className={rowClass}>
            <Mail className="text-primary size-4" /> contact@motionromania.com
          </a>
          <a href="tel:+40750420455" className={rowClass}>
            <Phone className="text-primary size-4" /> +40 750 420 455
          </a>
          <Link to="/contact" className={rowClass}>
            <MessageSquare className="text-primary size-4" /> Formularul de contact
          </Link>
        </div>
      </>
    ),
  },
]

export const TERMS_INTRO_SURFACE_KEY =
  'manual:section:titlu-si-introducere:9037039e-1a2d-4f70-b2df-415930db9cde'

export const TERMS_INTRO =
  'Motion România pune în legătură părinții cu cluburile și antrenorii din Timișoara. Contractul pentru curs, activitate sau tabără se încheie între tine și organizatorul afișat pe pagina ofertei; platforma se ocupă de cont, înscriere și plata online.'
