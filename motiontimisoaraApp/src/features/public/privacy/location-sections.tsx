import { Clock, Eye, MapPin } from 'lucide-react'

import type { LegalSection } from '../legal/LegalPage'
import { listClass } from './privacy-styles'

export const LOCATION_SECTIONS: LegalSection[] = [
  {
    id: 'ce-se-partajeaza',
    surfaceKey: 'manual:section:ce-se-partajeaza:f5dcfe06-1479-4ef9-9a87-49014723f58e',
    title: 'Locația antrenorului: ce se partajează',
    icon: MapPin,
    body: (
      <>
        <p>
          Antrenorul poate porni explicit partajarea poziției telefonului său pentru o ședință sau
          tabără. Funcția nu urmărește telefoanele copiilor și nu creează un istoric al deplasărilor
          lor. Se transmite periodic doar cea mai recentă poziție, precizia GPS și ora capturării.
          Temeiul este consimțământul: antrenorul pornește partajarea, iar părintele își dă acordul
          înainte să vadă poziția.
        </p>
        <p>
          Pe telefon, partajarea poate continua cu aplicația în fundal, după acordarea permisiunii
          de localizare. Indicatorul sistemului și notificarea de pe Android arată când localizarea
          este activă. În browser, partajarea se oprește când fila devine inactivă. Poți refuza ori
          retrage permisiunea de localizare din setările telefonului; fără ea, antrenorul folosește
          în continuare celelalte funcții ale aplicației.
        </p>
      </>
    ),
  },
  {
    id: 'cine-poate-vedea-pozitia',
    surfaceKey: 'manual:section:cine-poate-vedea-pozitia:7ecfa678-717e-4aaf-a6fc-22bf228cbc01',
    title: 'Locația: cine poate vedea poziția',
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
    surfaceKey: 'manual:section:cat-timp-raman-datele:352a1392-bb67-42bc-9c11-b106b70f534f',
    title: 'Locația: cât timp rămân datele',
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
]
