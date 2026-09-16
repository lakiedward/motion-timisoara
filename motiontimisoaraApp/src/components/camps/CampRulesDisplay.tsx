import { campRulesForDisplay } from '@/lib/camp-rules'

export default function CampRulesDisplay({ rules }: { rules: string | null | undefined }) {
  const text = campRulesForDisplay(rules)
  if (!text) return null
  return (
    <section className="mt-8">
      <h2 className="font-display mb-3 text-lg font-bold">Regulament</h2>
      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
    </section>
  )
}
