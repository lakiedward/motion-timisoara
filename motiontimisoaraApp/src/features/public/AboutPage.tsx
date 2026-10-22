import { Link } from 'react-router-dom'

import { SectionHeader } from '@/components/SectionHeader'
import { Card } from '@/components/ui/card'

const VALUES = [
  { title: 'Pasiune', text: 'Iubim sportul și transmitem această pasiune copiilor.' },
  { title: 'Siguranță', text: 'Antrenamente structurate, în medii sigure și supravegheate.' },
  { title: 'Comunitate', text: 'Construim prietenii și spirit de echipă, dincolo de competiție.' },
]

export default function AboutPage() {
  return (
    <div>
      <section className="from-primary/8 to-transparent border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Despre noi</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
            Construim <span className="text-primary">campioni</span>, dezvoltăm caractere
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
            Motion România este o comunitate dedicată sportului pentru copii — triatlon și
            multi-sport — unde fiecare copil crește în ritmul lui, alături de antrenori dedicați.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeader eyebrow="Valorile noastre" title="Ce ne ghidează" />
        <div className="grid gap-7 md:grid-cols-3">
          {VALUES.map((v) => (
            <Card key={v.title} className="gap-2 px-6">
              <h3 className="font-display text-xl font-bold text-foreground">{v.title}</h3>
              <p className="text-muted-foreground">{v.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl px-8 py-12 text-center" style={{ background: 'var(--gradient-primary)' }}>
          <h2 className="font-display text-2xl font-extrabold text-white md:text-3xl">
            Vrei să afli mai multe?
          </h2>
          <Link to="/contact" className="btn-cta btn-cta--white mt-6">
            Contactează-ne
          </Link>
        </div>
      </section>
    </div>
  )
}
