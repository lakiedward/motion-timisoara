import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { ScrollReveal } from '@/components/ScrollReveal'

const STATS = [
  { number: '11', label: 'Ani experiență' },
  { number: '200+', label: 'Copii antrenați' },
  { number: '8', label: 'Antrenori' },
  { number: '5', label: 'Sporturi' },
]

const PROGRAMS = [
  {
    icon: '🏊',
    title: 'Înot',
    desc: 'Tehnică, rezistență și siguranță în apă pentru începători și avansați.',
    price: '120 lei / lună',
    img: '/ui/20230516_184053.webp',
    popular: true,
  },
  {
    icon: '🚴',
    title: 'Ciclism',
    desc: 'Control, echilibru și anduranță pe bicicletă, în siguranță.',
    price: '150 lei / lună',
    img: '/ui/20220815_164301.webp',
    popular: false,
  },
  {
    icon: '🏃',
    title: 'Triatlon kids',
    desc: 'Înot, ciclism și alergare combinate — pentru micii campioni.',
    price: '180 lei / lună',
    img: '/ui/20221013_183129.webp',
    popular: false,
  },
]

const TESTIMONIALS = [
  {
    quote: 'Copilul meu abia așteaptă fiecare antrenament. Antrenorii sunt extraordinari!',
    name: 'Andreea M.',
    role: 'Părinte',
  },
  {
    quote: 'În doar un an a învățat să înoate corect și a câștigat încredere în el.',
    name: 'Cristian D.',
    role: 'Părinte',
  },
]

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/ui/20210713_105231.webp"
            alt=""
            className="size-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.78)_46%,rgba(255,255,255,0.15)_100%)]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <div className="max-w-xl">
            <span className="eyebrow mb-4">Triatlon pentru copii · Timișoara</span>
            <h1 className="font-display text-5xl leading-[1.05] font-extrabold text-foreground md:text-6xl">
              Creștem <span className="text-primary italic">campionii</span> de mâine 🚀
            </h1>
            <p className="text-muted-foreground mt-5 text-lg md:text-xl">
              Antrenamente de triatlon distractive și profesioniste pentru copii — înot, ciclism și
              alergare, alături de antrenori dedicați.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/signup" className="btn-cta btn-cta--primary">
                Înscrie-te <ArrowRight className="size-5" />
              </Link>
              <Link to="/cursuri" className="btn-cta btn-cta--outline">
                Vezi programele
              </Link>
            </div>
            <div className="border-border mt-10 flex flex-wrap gap-8 border-t pt-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-3xl font-extrabold text-foreground">
                    {s.number}
                  </div>
                  <div className="text-muted-foreground text-sm">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMS */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow mb-3">Programe</span>
          <h2 className="font-display text-4xl font-extrabold text-foreground">
            Alege <span className="text-primary">aventura</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Programe de antrenament potrivite pentru fiecare etapă de dezvoltare.
          </p>
        </div>

        <div className="grid gap-7 md:grid-cols-3">
          {PROGRAMS.map((p, i) => (
            <ScrollReveal key={p.title} delay={i * 90}>
              <article className="group bg-card overflow-hidden rounded-3xl shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover">
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={p.img}
                    alt={p.title}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {p.popular && (
                    <span
                      className="absolute top-4 left-4 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                      style={{ background: 'var(--gradient-warm)' }}
                    >
                      Popular
                    </span>
                  )}
                  <span className="bg-card absolute right-4 -bottom-6 grid size-12 place-items-center rounded-full text-2xl shadow-md">
                    {p.icon}
                  </span>
                </div>
                <div className="px-6 pt-8 pb-6">
                  <h3 className="font-display text-xl font-bold text-foreground">{p.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{p.desc}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-primary font-bold">{p.price}</span>
                    <Link
                      to="/cursuri"
                      className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-sm font-semibold transition-colors"
                    >
                      Detalii <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-muted/60 border-y">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="eyebrow mb-3">Părinți mulțumiți</span>
            <h2 className="font-display text-4xl font-extrabold text-foreground">
              Ce spun <span className="text-primary">familiile</span>
            </h2>
          </div>
          <div className="grid gap-7 md:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="bg-card rounded-3xl p-8 shadow-card">
                <blockquote className="text-foreground text-lg leading-relaxed italic">
                  <span className="text-primary mr-1 text-3xl leading-none align-middle opacity-40">
                    “
                  </span>
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full font-bold">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <div className="font-bold text-foreground">{t.name}</div>
                    <div className="text-muted-foreground text-sm">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div
          className="rounded-3xl px-8 py-16 text-center"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <h2 className="font-display text-3xl font-extrabold text-white md:text-4xl">
            Începe călătoria
          </h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-white/90">
            Alătură-te comunității Motion Timișoara și fă primul pas spre performanță.
          </p>
          <Link
            to="/signup"
            className="btn-cta mt-7 bg-white font-bold text-primary shadow-lg hover:scale-105"
          >
            Creează cont
          </Link>
        </div>
      </section>
    </>
  )
}
