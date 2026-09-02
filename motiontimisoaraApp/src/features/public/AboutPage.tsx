import { Link } from 'react-router-dom'

import { SectionHeader } from '@/components/SectionHeader'

const VALUES = [
  { title: 'Pasiune', text: 'Iubim sportul și transmitem această pasiune copiilor.' },
  { title: 'Siguranță', text: 'Antrenamente structurate, în medii sigure și supravegheate.' },
  { title: 'Comunitate', text: 'Construim prietenii și spirit de echipă, dincolo de competiție.' },
]

export default function AboutPage() {
  return (
    <div>
      {/* Same pale hero and the same left-aligned container as the sibling
          pages (Tabere, Antrenori, Cluburi, Activități): this was the only one
          centred, in a narrower column. */}
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Despre noi</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
            Construim <span className="text-primary">campioni</span>, dezvoltăm caractere
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            Motion Timișoara este o comunitate dedicată sportului pentru copii — triatlon și
            multi-sport — unde fiecare copil crește în ritmul lui, alături de antrenori dedicați.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeader eyebrow="Valorile noastre" title="Ce ne ghidează" />
        <div className="grid gap-7 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-card shadow-card rounded-3xl p-8">
              <h3 className="font-display text-xl font-bold text-foreground">{v.title}</h3>
              <p className="text-muted-foreground mt-2">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl px-8 py-12 text-center" style={{ background: 'var(--gradient-primary)' }}>
          <h2 className="font-display text-2xl font-extrabold text-white md:text-3xl">
            Vrei să afli mai multe?
          </h2>
          <Link to="/contact" className="btn-cta mt-6 bg-white font-bold text-primary hover:scale-105">
            Contactează-ne
          </Link>
        </div>
      </section>
    </div>
  )
}
