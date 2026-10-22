import type { ComponentType, ReactNode } from 'react'

export type LegalSection = {
  id: string
  title: string
  icon?: ComponentType<{ className?: string }>
  surfaceKey?: string
  body: ReactNode
}

const tocLinkClass =
  'hover:text-primary min-h-touch-target flex items-center rounded-xl underline-offset-4 hover:underline focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'

export function LegalPage({
  title,
  intro,
  version,
  updated,
  sections,
  introSurfaceKey,
}: {
  title: string
  intro: ReactNode
  version: string
  updated: string
  sections: LegalSection[]
  introSurfaceKey?: string
}) {
  return (
    <div>
      <section
        data-section={introSurfaceKey}
        className="from-primary/8 border-b bg-gradient-to-b to-transparent"
      >
        <div className="mx-auto max-w-5xl px-6 py-14">
          <span className="eyebrow mb-3">Informații legale</span>
          <h1 className="font-display text-foreground text-4xl font-extrabold md:text-5xl">
            {title}
          </h1>
          <div className="text-muted-foreground mt-4 max-w-2xl text-lg">{intro}</div>
          <p className="text-muted-foreground mt-4 text-sm">
            Versiunea {version} · ultima actualizare: {updated}
          </p>
        </div>
      </section>
      <article className="mx-auto max-w-5xl space-y-10 px-6 py-12">
        <nav aria-label="Cuprins" className="max-w-3xl border-b pb-6">
          <p className="eyebrow mb-2">Cuprins</p>
          <ol className="text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={tocLinkClass}>
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map((s, i) => {
          const Icon = s.icon
          return (
            <section
              key={s.id}
              id={s.id}
              data-section={s.surfaceKey}
              aria-labelledby={`${s.id}-titlu`}
              className="max-w-3xl scroll-mt-24 space-y-3"
            >
              <h2
                id={`${s.id}-titlu`}
                className="font-display text-foreground flex items-center gap-2 text-2xl font-bold"
              >
                {Icon ? <Icon className="text-primary size-5 shrink-0" /> : null}
                <span>
                  <span className="text-primary">{i + 1}.</span> {s.title}
                </span>
              </h2>
              <div className="space-y-3 leading-relaxed">{s.body}</div>
            </section>
          )
        })}
      </article>
    </div>
  )
}
