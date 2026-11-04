import { Link } from 'react-router-dom'
import { Ban, Receipt } from 'lucide-react'

import type { LegalSection } from '../legal/LegalPage'
import { OPERATOR_CUI, OPERATOR_NAME, OPERATOR_REG_COM } from '../legal/operator'

const linkClass = 'text-primary underline underline-offset-4'
const listClass = 'list-disc space-y-2 pl-5'

export const SUBSCRIPTION_PLANS_SECTION: LegalSection = {
  id: 'abonamente-planuri-si-plata',
  surfaceKey:
    'manual:section:abonamente-planuri-plata-si-facturare:7d1e155f-3d36-480a-b4b6-28a35ac05fc9',
  icon: Receipt,
  title: 'Abonamente: planuri, plată și facturare',
  body: (
    <>
      <p>
        Părinții folosesc Motion România gratuit. Un antrenor independent sau un club care vrea să
        apară în căutare și să primească înscrieri plătește un abonament lunar, pe care îl încheie
        cu {OPERATOR_NAME} (CUI {OPERATOR_CUI}, {OPERATOR_REG_COM}), operatorul platformei.
        Abonamentul este pentru activitatea ta profesională.
      </p>
      <ul className={listClass}>
        <li>
          <strong>Prețuri:</strong> sunt în lei, pe lună, și finale. Operatorul nu este plătitor de
          TVA, deci nu adaugă TVA. Antrenor independent: 100 lei. Club Start, până la 3 antrenori:
          199 lei. Club, până la 10 antrenori: 349 lei. Club Pro, antrenori fără limită: 599 lei.
          Prețurile curente sunt și pe pagina{' '}
          <Link className={linkClass} to="/preturi">
            Prețuri
          </Link>
          .
        </li>
        <li>
          <strong>Cine plătește:</strong> ofertele unui club sunt acoperite de abonamentul clubului,
          iar antrenorii care predau în el nu plătesc nimic pentru ele. Ofertele proprii ale unui
          antrenor sunt acoperite de abonamentul lui. Un antrenor care predă doar în cluburi nu are
          nevoie de abonament.
        </li>
        <li>
          <strong>Perioada gratuită:</strong> conturile create înainte de lansarea abonamentelor
          primesc 3 luni gratuite, numărate de la data lansării, anunțată pe site. Conturile create
          după lansare primesc 30 de zile gratuite de la creare (antrenor) sau de la aprobare
          (club). Nu ți se cere cardul în această perioadă.
        </li>
        <li>
          <strong>Plata:</strong> plătești cu cardul, prin Stripe. Dacă alegi un plan în perioada
          gratuită, prima plată se face la sfârșitul ei; dacă au rămas mai puțin de 48 de ore,
          plătești imediat. Apoi abonamentul se reînnoiește automat în fiecare lună, în aceeași zi,
          până îl anulezi.
        </li>
        <li>
          <strong>Schimbarea planului:</strong> treci la un plan mai mare oricând, iar diferența se
          calculează proporțional cu zilele rămase. Treci la un plan mai mic de la următoarea
          perioadă, doar dacă numărul tău de antrenori încape în el; nimeni nu este scos automat din
          club. La limita planului nu mai poți adăuga antrenori până nu treci la unul mai mare.
        </li>
        <li>
          <strong>Schimbarea prețurilor:</strong> te anunțăm pe email cu cel puțin 30 de zile
          înainte. Prețul nou se aplică de la prima reînnoire după acel termen, iar până atunci poți
          anula. Dacă operatorul devine plătitor de TVA, prețurile nu se schimbă automat; orice
          schimbare se anunță tot cu 30 de zile înainte.
        </li>
        <li>
          <strong>Facturare:</strong> {OPERATOR_NAME} emite factura pentru fiecare plată, fără TVA,
          pe datele de facturare pe care le completezi înainte de prima plată: numele sau denumirea,
          CUI dacă ai firmă sau PFA, adresa. Chitanța Stripe nu este factură fiscală. Datele de
          facturare sunt tratate în{' '}
          <Link className={linkClass} to="/confidentialitate">
            politica de confidențialitate
          </Link>
          .
        </li>
        <li>
          <strong>Acceptare:</strong> înainte de plată, Stripe îți cere să bifezi acceptarea acestor
          termeni. Păstrăm versiunea acceptată și data.
        </li>
        <li>
          <strong>Plățile de la părinți:</strong> sunt separate de abonament. Pentru o plată cu
          cardul primită de la un părinte, platforma reține doar costul exact al procesării Stripe
          pentru acea plată, fără alt comision. Banii ajung în contul tău Stripe și se virează
          săptămânal, lunea. Dacă rambursezi o înscriere plătită cu cardul, comisionul Stripe al
          acelei plăți rămâne în sarcina ta: Stripe nu îl returnează, iar platforma nu îl suportă în
          locul tău.
        </li>
      </ul>
    </>
  ),
}

export const SUBSCRIPTION_CANCEL_SECTION: LegalSection = {
  id: 'abonamente-anulare-si-expirare',
  surfaceKey:
    'manual:section:abonamente-anulare-rambursare-si-expirar:e6aa4370-39f7-40a7-94ae-067c5feb8e9b',
  icon: Ban,
  title: 'Abonamente: anulare, rambursare și expirare',
  body: (
    <ul className={listClass}>
      <li>
        <strong>Anulare:</strong> anulezi oricând din pagina de abonament a panoului tău, prin
        portalul de facturare Stripe. Anularea are efect la sfârșitul perioadei deja plătite: până
        atunci păstrezi accesul complet și nu se mai face nicio plată. Anularea cu efect imediat nu
        există.
      </li>
      <li>
        <strong>Rambursare:</strong> nu rambursăm parțial luna începută și nu rambursăm lunile
        trecute. Rambursăm integral o plată făcută de două ori, o sumă greșită sau o plată pentru o
        lună în care o eroare a platformei ți-a blocat accesul. Dacă folosești abonamentul ca
        persoană fizică, în afara activității tale profesionale, drepturile legale ale
        consumatorului, inclusiv dreptul de retragere de 14 zile, rămân neatinse.
      </li>
      <li>
        <strong>Plată nereușită:</strong> dacă o reînnoire eșuează, Stripe reîncearcă plata timp de
        7 zile, iar accesul rămâne în acest timp. Dacă plata tot nu reușește, abonamentul expiră.
      </li>
      <li>
        <strong>Expirare:</strong> abonamentul expiră când perioada gratuită se termină fără un plan
        ales, când cele 7 zile de după o plată nereușită trec, sau când o perioadă anulată se
        încheie. Atunci ofertele și profilul tău dispar din căutare, din liste și de pe hartă, iar
        părinții nu mai pot face înscrieri noi.
      </li>
      <li>
        <strong>Ce rămâne după expirare:</strong> nu ștergem nimic. Înscrierile făcute, plățile,
        prezența și anunțurile continuă, iar părinții înscriși își văd în continuare ofertele.
        Panoul tău rămâne accesibil, iar ofertele noi se salvează, dar apar abia după reactivare.
        Dacă plătești din nou, totul reapare imediat. Rămâi răspunzător față de părinții deja
        înscriși, ca organizator.
      </li>
    </ul>
  ),
}

export const SUBSCRIPTION_TERMS_SECTIONS: LegalSection[] = [
  SUBSCRIPTION_PLANS_SECTION,
  SUBSCRIPTION_CANCEL_SECTION,
]
