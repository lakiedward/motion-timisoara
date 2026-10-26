import {
  campRequirementLabel,
  CAMP_REQUIREMENTS_TITLE,
  type CampRequirementCategory,
} from '@/lib/camp-requirements'
import { cn } from '@/lib/utils'

export default function CampRequirementsDisplay({
  necesar,
}: {
  necesar: CampRequirementCategory[]
}) {
  if (necesar.length === 0) return null
  return (
    <div className="bg-card mt-8 rounded-xl border p-5 sm:p-6">
      <h2 className="font-display mb-3 text-xl font-bold">{CAMP_REQUIREMENTS_TITLE}</h2>
      <div className="space-y-5">
        {necesar.map((categorie) => {
          const repetaTitlul =
            categorie.name.toLocaleLowerCase('ro') ===
            CAMP_REQUIREMENTS_TITLE.toLocaleLowerCase('ro')
          return (
            <section key={categorie.name} aria-label={categorie.name}>
              {!repetaTitlul && <h3 className="font-medium">{categorie.name}</h3>}
              <ul
                className={cn(
                  'text-muted-foreground list-disc space-y-2 pl-5',
                  !repetaTitlul && 'mt-2',
                )}
              >
                {categorie.items.map((articol) => (
                  <li key={articol.name}>{campRequirementLabel(articol)}</li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
