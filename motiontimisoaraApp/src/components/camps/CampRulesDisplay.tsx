import { Download } from 'lucide-react'

import {
  campRulesForDisplay,
  campRulesFileKindLabel,
  formatCampRulesFileSize,
  type CampRulesFileLink,
} from '@/lib/camp-rules'

export default function CampRulesDisplay({
  rules,
  fisier,
}: {
  rules: string | null | undefined
  fisier?: CampRulesFileLink | null
}) {
  const text = campRulesForDisplay(rules)
  if (!text && !fisier) return null
  return (
    <section className="mt-8">
      <h2 className="font-display mb-3 text-lg font-bold">Regulament</h2>
      {text && <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{text}</p>}
      {fisier && (
        <a
          href={fisier.url}
          target="_blank"
          rel="noopener noreferrer"
          download={fisier.name}
          className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 font-semibold"
        >
          <Download className="size-4" aria-hidden="true" />
          <span>
            {fisier.name}
            <span className="text-muted-foreground font-normal">
              {' '}
              · {campRulesFileKindLabel(fisier.contentType)} ·{' '}
              {formatCampRulesFileSize(fisier.sizeBytes)}
            </span>
          </span>
        </a>
      )}
    </section>
  )
}
