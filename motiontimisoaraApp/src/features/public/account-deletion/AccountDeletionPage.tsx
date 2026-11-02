import { Link } from 'react-router-dom'
import { Archive, ListChecks, MessageSquare, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DELETED_ITEMS, KEPT_ITEMS } from '@/features/account/profile/delete-account-items'
import { LegalPage, type LegalSection } from '../legal/LegalPage'
import { PRIVACY_EMAIL } from '../legal/operator'
import { linkClass, listClass } from '../privacy/privacy-styles'

const SECTIONS: LegalSection[] = [
  {
    id: 'pasi',
    title: 'Cum îți ștergi contul',
    icon: ListChecks,
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Intră în cont, în aplicația Motion România sau pe site.</li>
          <li>
            Deschide <strong>Profilul meu</strong> și mergi la cardul{' '}
            <strong>Ștergerea contului</strong>.
          </li>
          <li>
            Apasă <strong>Șterge contul</strong>, bifează „Am înțeles că ștergerea este definitivă”
            și confirmă.
          </li>
        </ol>
        <p>Contul se șterge imediat și te deconectăm de pe toate dispozitivele.</p>
        <Button asChild className="min-h-touch-target">
          <Link to="/account/profile#sterge-contul">Intră în cont și șterge-l</Link>
        </Button>
      </>
    ),
  },
  {
    id: 'ce-se-sterge',
    title: 'Ce se șterge',
    icon: Trash2,
    body: (
      <>
        <ul className={listClass}>
          {DELETED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Înscrierile active se anulează. Ședințele plătite nu se rambursează automat, așa că
          vorbește cu clubul înainte, dacă ai ședințe rămase.
        </p>
      </>
    ),
  },
  {
    id: 'ce-pastram',
    title: 'Ce păstrăm și cât timp',
    icon: Archive,
    body: (
      <>
        <ul className={listClass}>
          {KEPT_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Aceste evidențe nu mai sunt legate de un cont și nu mai pot fi folosite pentru a intra în
          aplicație. Copiile de siguranță ale furnizorilor se rotesc după termenele lor, așa că
          ștergerea ajunge în ele cu întârziere.
        </p>
      </>
    ),
  },
  {
    id: 'alte-cereri',
    title: 'Nu mai poți intra în cont sau ai cont de club ori antrenor',
    icon: MessageSquare,
    body: (
      <p>
        Scrie-ne la{' '}
        <a className={linkClass} href={`mailto:${PRIVACY_EMAIL}`}>
          {PRIVACY_EMAIL}
        </a>{' '}
        sau prin{' '}
        <Link className={linkClass} to="/contact">
          pagina de contact
        </Link>
        , de pe adresa de email a contului. Conturile de club și de antrenor au cursuri și copii
        înscriși, așa că le ștergem la cerere, după ce stabilim ce se întâmplă cu ele. Îți răspundem
        în cel mult o lună.
      </p>
    ),
  },
]

export default function AccountDeletionPage() {
  return (
    <LegalPage
      title="Ștergerea contului"
      intro="Cum îți ștergi contul Motion România, ce date se șterg și ce păstrăm, doar cât cere legea."
      version="1.0"
      updated="2 noiembrie 2026"
      sections={SECTIONS}
    />
  )
}
