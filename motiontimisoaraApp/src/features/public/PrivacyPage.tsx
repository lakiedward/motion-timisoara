import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <article className="container mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Confidențialitate și partajarea locației</h1>
      <p className="text-muted-foreground">Informații despre funcția „Locația antrenorului”.</p>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Ce se partajează</h2>
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
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Cine poate vedea poziția</h2>
        <p>
          Antrenorul ședinței și clubul proprietar au acces. Un părinte vede poziția doar după
          acordul său explicit, dacă propriul copil este înscris activ și este marcat prezent, cu
          scanare QR confirmată pentru aceeași ședință. Accesul este verificat din nou la fiecare
          cerere. În tabără, părintele are nevoie de un copil înscris activ, cu sosirea confirmată
          și fără plecare înregistrată. Prezența se confirmă o singură dată la sosire, fără scanări
          repetate pentru fiecare pornire. Locația activă apare în Anunțuri, fără a salva coordonate
          în anunțurile generale. Antrenorul proprietar sau însoțitorul care a acceptat invitația
          pornește explicit partajarea.
        </p>
        <p>
          Părintele poate apăsa „Retrage acordul”. Antrenorul poate apăsa „Oprește locația” din
          orice ecran al aplicației. Repornirea unei partajări cere un acord nou al părintelui. O
          poziție deja văzută sau capturată de altă persoană nu poate fi retrasă de pe dispozitivul
          acelei persoane.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Cât timp rămân datele</h2>
        <p>
          Pentru cursuri, partajarea se încheie cel târziu la sfârșitul ședinței plus 15 minute.
          Pentru tabere, o pornire durează maximum 8 ore și nu depășește încheierea taberei,
          calculată în fusul Europe/Bucharest. Antrenorul poate opri oricând și poate porni din nou
          explicit. Oprirea șterge poziția din datele active ale aplicației. La expirare, accesul
          este refuzat imediat, iar curățarea programată șterge rândurile la următoarea rulare
          reușită, programată în fiecare minut.
        </p>
        <p>
          Pozițiile succesive înlocuiesc punctul anterior; aplicația nu păstrează trasee și nu
          salvează poziții în istoricul copilului. Identificatorii necesari protecției împotriva
          cererilor repetate sunt păstrați până la încheierea intervalului ședinței sau taberei.
          Copiile de siguranță și jurnalele tehnice ale infrastructurii au propriile reguli de
          retenție; ștergerea din aplicație nu înseamnă ștergere instantanee din aceste copii.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Furnizori și control</h2>
        <p>
          Supabase procesează autentificarea, datele și notificările de actualizare. Notificările
          live nu conțin coordonate; infrastructura poate păstra temporar identificatorul canalului
          și ora evenimentului. Harta folosește CARTO și date OpenStreetMap; încărcarea hărții
          transmite furnizorului adresa IP și zona de hartă solicitată.
        </p>
        <p>
          Poți refuza ori retrage permisiunea de localizare din setările telefonului. Fără ea,
          antrenorul poate folosi celelalte funcții ale aplicației. Pentru întrebări despre datele
          tale, folosește{' '}
          <Link className="text-primary underline" to="/contact">
            pagina de contact
          </Link>{' '}
          sau discută cu clubul care organizează ședința.
        </p>
      </section>
    </article>
  )
}
