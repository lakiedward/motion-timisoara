import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="eyebrow mb-3">Eroare 404</span>
      <h1 className="font-display text-foreground text-3xl font-extrabold md:text-4xl">
        Pagina nu a fost găsită
      </h1>
      <p className="text-muted-foreground mt-3 text-lg">
        Linkul este greșit sau pagina a fost mutată. Pornește de la pagina principală sau caută un
        curs pentru copilul tău.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-11">
          <Link to="/">Mergi la pagina principală</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11">
          <Link to="/cursuri">Vezi cursurile</Link>
        </Button>
      </div>
    </section>
  )
}
