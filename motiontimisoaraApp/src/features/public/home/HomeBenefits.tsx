const BENEFITS = [
  {
    title: 'Profiluri publice și evaluări',
    text: 'Fiecare club și antrenor are o pagină cu sporturile, locațiile și evaluările lăsate de părinți.',
  },
  {
    title: 'Mai multe sporturi',
    text: 'Înot, ciclism, alergare, triatlon și altele, de la cluburi diferite, în aceeași listă.',
  },
  {
    title: 'Plată online sau cash',
    text: 'Plătești cu cardul la înscriere sau cash la club, iar istoricul plăților rămâne în contul tău.',
  },
  {
    title: 'Calendar, prezență și anunțuri',
    text: 'Vezi programul copilului, prezența la antrenamente și anunțurile antrenorilor.',
  },
]

export function HomeBenefits() {
  return (
    <section aria-labelledby="home-benefits-title" className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <div className="mb-12 max-w-2xl">
        <span className="eyebrow mb-3">De ce Motion România</span>
        <h2
          id="home-benefits-title"
          className="font-display text-foreground text-3xl font-extrabold md:text-4xl"
        >
          Toate cluburile din oraș, într-un singur loc
        </h2>
        <p className="text-muted-foreground mt-3 text-lg">
          Cluburi și antrenori independenți își publică aici programele, iar tu alegi ce i se
          potrivește copilului.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {BENEFITS.map((benefit, index) => (
          <li key={benefit.title} className="bg-card flex gap-5 rounded-xl border p-6">
            <span
              aria-hidden="true"
              className="font-display text-primary text-3xl leading-none font-extrabold"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="font-display text-foreground text-lg font-bold">{benefit.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm">{benefit.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
