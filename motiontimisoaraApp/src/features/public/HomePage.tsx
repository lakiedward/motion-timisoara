import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bike,
  CreditCard,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Trophy,
  Waves,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollReveal } from '@/components/ScrollReveal'

const VALUE_PROPS = [
  { icon: ShieldCheck, title: 'Antrenori verificați', text: 'Cluburi și antrenori de încredere, cu profiluri publice și evaluări.' },
  { icon: Trophy, title: 'Multi-sport', text: 'Înot, ciclism, alergare și mai mult — totul într-un singur loc.' },
  { icon: CreditCard, title: 'Plăți simple', text: 'Înscrieri și plăți online sau cash, cu istoric clar pentru părinți.' },
  { icon: MessagesSquare, title: 'Mereu informat', text: 'Calendar, prezență și anunțuri în timp real de la antrenori.' },
]

const PROGRAMS = [
  { sport: 'Înot', icon: Waves, age: '6–10 ani', level: 'Începător', price: '120 lei / lună' },
  { sport: 'Ciclism', icon: Bike, age: '8–12 ani', level: 'Intermediar', price: '150 lei / lună' },
  { sport: 'Triatlon kids', icon: Trophy, age: '10–14 ani', level: 'Avansat', price: '180 lei / lună' },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="from-primary/12 via-background to-background relative overflow-hidden bg-gradient-to-b">
        <div className="bg-highlight/15 pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-2xl" />
        <div className="bg-primary/15 pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full blur-2xl" />
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="max-w-3xl">
            <Badge variant="highlight" className="mb-5">
              Sport pentru copii în Timișoara
            </Badge>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
              Construim <span className="text-primary">campionii</span> de mâine
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg">
              Cursuri, tabere și activități multi-sport pentru copii — alături de antrenori și
              cluburi de încredere. Înscrie-ți copilul în câteva minute.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/cursuri">
                  Vezi programe <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/signup">Înregistrează-te</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((vp, i) => (
            <ScrollReveal key={vp.title} delay={i * 80}>
              <Card className="h-full">
                <CardContent className="space-y-3">
                  <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
                    <vp.icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{vp.title}</h3>
                  <p className="text-muted-foreground text-sm">{vp.text}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Programs preview */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Programe populare</h2>
              <p className="text-muted-foreground mt-1">Alege sportul potrivit pentru copilul tău.</p>
            </div>
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/cursuri">
                Toate cursurile <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PROGRAMS.map((p, i) => (
              <ScrollReveal key={p.sport} delay={i * 80}>
                <Card className="group h-full overflow-hidden pt-0">
                  <div className="from-primary/15 to-highlight/15 text-primary flex h-32 items-center justify-center bg-gradient-to-br">
                    <p.icon className="size-12" />
                  </div>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge>{p.sport}</Badge>
                      <Badge variant="outline">{p.level}</Badge>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 text-sm">
                      <MapPin className="size-4" /> Timișoara · {p.age}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-display text-lg font-bold">{p.price}</span>
                      <Button size="sm" variant="secondary" asChild>
                        <Link to="/cursuri">Detalii</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-2xl px-8 py-12 text-center md:py-16">
          <div className="bg-highlight/25 pointer-events-none absolute -top-16 -right-10 size-56 rounded-full blur-2xl" />
          <h2 className="text-2xl font-bold md:text-4xl">Gata să începeți?</h2>
          <p className="text-primary-foreground/80 mx-auto mt-3 max-w-md">
            Creează un cont gratuit și înscrie-ți copilul la primul curs astăzi.
          </p>
          <Button size="lg" variant="secondary" asChild className="mt-6">
            <Link to="/signup">Creează cont</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
