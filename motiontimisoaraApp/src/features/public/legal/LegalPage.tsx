import type { ComponentType, ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type LegalSection = {
  id: string
  title: string
  icon?: ComponentType<{ className?: string }>
  body: ReactNode
}

export type LegalLayout = 'document' | 'cards'

const tocLinkClass =
  'hover:text-primary min-h-touch-target flex items-center rounded-xl underline-offset-4 hover:underline focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'

function LegalToc({ sections, className }: { sections: LegalSection[]; className?: string }) {
  return (
    <nav aria-label="Cuprins" className={className}>
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
  )
}

function SectionTitle({
  section,
  index,
  size,
}: {
  section: LegalSection
  index: number
  size: string
}) {
  const Icon = section.icon
  return (
    <h2 className={cn('font-display text-foreground flex items-center gap-2 font-bold', size)}>
      {Icon ? <Icon className="text-primary size-5 shrink-0" /> : null}
      <span>
        <span className="text-primary">{index + 1}.</span> {section.title}
      </span>
    </h2>
  )
}

export function LegalPage({
  title,
  intro,
  version,
  updated,
  sections,
  layout = 'document',
}: {
  title: string
  intro: ReactNode
  version: string
  updated: string
  sections: LegalSection[]
  layout?: LegalLayout
}) {
  return (
    <div>
      <section className="from-primary/8 border-b bg-gradient-to-b to-transparent">
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
      {layout === 'cards' ? (
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[220px_1fr]">
          <LegalToc sections={sections} className="lg:sticky lg:top-24 lg:self-start" />
          <div className="space-y-6">
            {sections.map((s, i) => (
              <Card
                key={s.id}
                id={s.id}
                className="scroll-mt-24 gap-3 rounded-2xl px-6 shadow-none"
              >
                <SectionTitle section={s} index={i} size="text-xl" />
                <div className="space-y-3 leading-relaxed">{s.body}</div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <article className="mx-auto max-w-5xl space-y-10 px-6 py-12">
          <LegalToc sections={sections} className="max-w-3xl border-b pb-6" />
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="max-w-3xl scroll-mt-24 space-y-3">
              <SectionTitle section={s} index={i} size="text-2xl" />
              <div className="space-y-3 leading-relaxed">{s.body}</div>
            </section>
          ))}
        </article>
      )}
    </div>
  )
}
