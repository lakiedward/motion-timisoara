import { useId, useState } from 'react'
import { FileText } from 'lucide-react'

import { campRulesForDisplay, campRulesSummary, type CampRulesFileLink } from '@/lib/camp-rules'
import { CampRulesBody } from '@/components/camps/CampRulesDisplay'
import { Button } from '@/components/ui/button'

export function CampRulesCard({
  rules,
  fisier = null,
}: {
  rules: string | null | undefined
  fisier?: CampRulesFileLink | null
}) {
  const [deschis, setDeschis] = useState(false)
  const continutId = useId()
  const titluId = useId()
  const text = campRulesForDisplay(rules)
  if (!text && !fisier) return null
  return (
    <section aria-labelledby={titluId} className="bg-card my-6 space-y-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id={titluId} className="font-semibold">
              Regulament
            </h2>
            <p className="text-muted-foreground text-sm">{campRulesSummary(text, fisier)}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          aria-expanded={deschis}
          aria-controls={continutId}
          onClick={() => setDeschis((v) => !v)}
        >
          {deschis ? 'Ascunde regulamentul' : 'Citește regulamentul'}
        </Button>
      </div>
      <div id={continutId} hidden={!deschis} className="max-w-prose">
        {deschis && <CampRulesBody text={text} fisier={fisier} clamp={false} />}
      </div>
    </section>
  )
}
