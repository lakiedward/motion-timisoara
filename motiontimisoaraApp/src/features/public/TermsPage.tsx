import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <article className="container mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Termeni și condiții</h1>
      <p className="text-muted-foreground">
        Acești termeni se aplică utilizării platformei Motion Timișoara și înscrierii la
        activitățile, cursurile sau taberele disponibile în aplicație.
      </p>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Înscrieri și plăți</h2>
        <p>
          Înainte de finalizarea unei înscrieri, verifică activitatea aleasă, copiii selectați,
          suma finală și metoda de plată. O înscriere devine activă după confirmarea ei conform
          opțiunii de plată disponibile.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Participare în siguranță</h2>
        <p>
          Părintele sau reprezentantul legal trebuie să ofere informații corecte despre copil și
          să respecte instrucțiunile organizatorului privind programul, echipamentul și siguranța
          activității.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Date personale</h2>
        <p>
          Prelucrăm datele necesare administrării contului, înscrierilor și activităților.
          Detaliile despre prelucrarea datelor și partajarea locației sunt disponibile în{' '}
          <Link className="text-primary underline" to="/confidentialitate">
            politica de confidențialitate
          </Link>
          .
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Contact</h2>
        <p>
          Pentru întrebări despre o înscriere sau acești termeni, folosește{' '}
          <Link className="text-primary underline" to="/contact">
            pagina de contact
          </Link>
          .
        </p>
      </section>
    </article>
  )
}
