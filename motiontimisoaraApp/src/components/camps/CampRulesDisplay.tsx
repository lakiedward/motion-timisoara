import { useId, useState } from 'react'
import { ExternalLink } from 'lucide-react'

import {
  campRulesFileDetails,
  campRulesForDisplay,
  campRulesIsLong,
  type CampRulesFileLink,
} from '@/lib/camp-rules'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CampRulesBody({
  text,
  fisier,
  clamp = true,
}: {
  text: string | null
  fisier?: CampRulesFileLink | null
  clamp?: boolean
}) {
  const [extins, setExtins] = useState(false)
  const textId = useId()
  const lung = clamp && text !== null && campRulesIsLong(text)
  const scurtat = lung && !extins
  const detalii = fisier ? campRulesFileDetails(fisier) : ''
  return (
    <>
      {text && (
        <p
          id={textId}
          className={cn(
            'text-muted-foreground whitespace-pre-wrap leading-relaxed',
            scurtat && 'line-clamp-8',
          )}
        >
          {text}
        </p>
      )}
      {lung && (
        <Button
          type="button"
          variant="link"
          className="mt-1 flex h-11 min-h-11 w-fit px-0 font-semibold"
          aria-expanded={extins}
          aria-controls={textId}
          onClick={() => setExtins((v) => !v)}
        >
          {extins ? 'Arată mai puțin' : 'Arată tot regulamentul'}
        </Button>
      )}
      {fisier && (
        <a
          href={fisier.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Deschide regulamentul: ${fisier.name}, ${detalii}`}
          title={fisier.name}
          className="group text-primary focus-visible:outline-ring mt-3 flex min-h-11 w-fit items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="font-semibold underline-offset-4 group-hover:underline">
              Deschide regulamentul
            </span>
            <span className="text-muted-foreground text-sm">{detalii}</span>
          </span>
        </a>
      )}
    </>
  )
}

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
    <section className="bg-card mt-8 rounded-xl border p-5 sm:p-6">
      <h2 className="font-display mb-3 text-xl font-bold">Regulament</h2>
      <CampRulesBody text={text} fisier={fisier} />
    </section>
  )
}
