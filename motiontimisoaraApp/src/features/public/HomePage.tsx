import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CreditCard, MessagesSquare, ShieldCheck, Trophy } from 'lucide-react'

import { ScrollReveal } from '@/components/ScrollReveal'
import { getCourses } from '@/api/public'
import { CourseCard } from './components/CourseCard'

const STATS = [
  { number: '11', label: 'Ani experiență' },
  { number: '200+', label: 'Copii antrenați' },
  { number: '8', label: 'Antrenori' },
  { number: '5', label: 'Sporturi' },
]

const VALUE_PROPS = [
  { icon: ShieldCheck, title: 'Antrenori verificați', text: 'Cluburi și antrenori de încredere, cu profiluri publice și evaluări.' },
  { icon: Trophy, title: 'Multi-sport', text: 'Înot, ciclism, alergare și mai mult — totul într-un singur loc.' },
  { icon: CreditCard, title: 'Plăți simple', text: 'Înscrieri și plăți online sau cash, cu istoric clar pentru părinți.' },
  { icon: MessagesSquare, title: 'Mereu informat', text: 'Calendar, prezență și anunțuri în timp real de la antrenori.' },
]

const TESTIMONIALS = [
  { quote: 'Copilul meu abia așteaptă fiecare antrenament. Antrenorii sunt extraordinari!', name: 'Andreea M.', role: 'Părinte' },
  { quote: 'În doar un an a învățat să înoate corect și a câștigat încredere în el.', name: 'Cristian D.', role: 'Părinte' },
]

export default function HomePage() {
  const { data: courses = [] } = useQuery({ queryKey: ['courses', 'all'], queryFn: () => getCourses() })
  const topCourses = courses.slice(0, 3)

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src="/ui/20210713_105231.webp" alt="" className="size-full object-cover" fetchPriority="high" />
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
                  <div className="font-display text-3xl font-extrabold text-foreground">{s.number}</div>
                  <div className="text-muted-foreground text-sm">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((vp, i) => (
            <ScrollReveal key={vp.title} delay={i * 80}>
              <div className="bg-card shadow-card h-full space-y-3 rounded-3xl p-6">
                <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
                  <vp.icon className="size-5" />
                </span>
                <h3 className="font-display font-bold">{vp.title}</h3>
                <p className="text-muted-foreground text-sm">{vp.text}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* PROGRAMS (real data) */}
      {topCourses.length > 0 && (
        <section className="bg-muted/40 border-y">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <span className="eyebrow mb-2">Programe</span>
                <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                  Programe populare
                </h2>
              </div>
              <Link to="/cursuri" className="text-primary hidden items-center gap-1 font-semibold sm:inline-flex">
                Toate cursurile <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-7 md:grid-cols-3">
              {topCourses.map((c, i) => (
                <ScrollReveal key={c.id} delay={i * 80}>
                  <CourseCard course={c} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-7 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="bg-card shadow-card rounded-3xl p-8">
              <blockquote className="text-foreground text-lg leading-relaxed italic">
                <span className="text-primary mr-1 align-middle text-3xl leading-none opacity-40">“</span>
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
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center" style={{ background: 'var(--gradient-primary)' }}>
          <h2 className="font-display text-2xl font-extrabold text-white md:text-4xl">Începe călătoria</h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-white/90">
            Creează un cont gratuit și înscrie-ți copilul la primul curs astăzi.
          </p>
          <Link to="/signup" className="btn-cta mt-6 bg-white font-bold text-primary hover:scale-105">
            Creează cont
          </Link>
        </div>
      </section>
    </>
  )
}
