import { Link } from 'react-router-dom'

import { childAge, type Child } from '@/api/account'
import type { CompetitionRegistrationVerdict } from '@/api/competition/competition-registration'
import { formatRonOffer } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu } from '@/components/ui/select-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'

type Option = { value: string; label: string }

type Props = {
  showChildren: boolean
  children: Child[] | undefined
  childrenLoading: boolean
  childrenFailed: boolean
  retryChildren: () => void
  choice: Record<string, string>
  onChoice: (childId: string, categoryId: string) => void
  categoryOptions: Option[]
  verdictFor: (key: string) => CompetitionRegistrationVerdict | undefined
  includeSelf: boolean
  onIncludeSelf: (value: boolean) => void
  selfBirthDate: string
  onSelfBirthDate: (value: string) => void
  selfCategoryId: string
  onSelfCategory: (value: string) => void
  validationFailed: boolean
  retryValidation: () => void
}

function VerifiedPrice({ verdict }: { verdict: CompetitionRegistrationVerdict | undefined }) {
  if (!verdict?.eligible || typeof verdict.amount !== 'number') return null
  return (
    <p className="text-muted-foreground mt-2 text-sm">
      Preț verificat: {formatRonOffer(verdict.amount)}
    </p>
  )
}

export function CompetitionParticipantsStep(props: Props) {
  const self = props.verdictFor('self')
  return (
    <section className="space-y-4" aria-label="Copii și categorii">
      {props.showChildren &&
        (props.childrenLoading ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : props.childrenFailed ? (
          <StatusView
            state="error"
            title="Nu am putut încărca lista de copii."
            onRetry={props.retryChildren}
          />
        ) : props.children?.length === 0 ? (
          <StatusView
            state="empty"
            title="Nu ai copii adăugați. Te poți înscrie pe tine mai jos."
            action={
              <Button asChild variant="outline" className="mt-3 h-touch-target min-h-touch-target">
                <Link to="/account/child/new">Adaugă copil</Link>
              </Button>
            }
          />
        ) : (
          props.children?.map((child) => {
            const verdict = props.verdictFor(child.id)
            return (
              <div
                key={child.id}
                className={cn('rounded-xl border p-4', verdict?.eligible && 'border-primary')}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full font-bold"
                  >
                    {child.name.charAt(0)}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={`competition-category-${child.id}`} className="font-semibold">
                      {child.name}
                    </Label>
                    <span className="text-muted-foreground text-sm">
                      {childAge(child.birth_date)} ani
                    </span>
                    {verdict?.eligible && <Badge variant="success">Poate participa</Badge>}
                    {verdict && !verdict.eligible && <Badge variant="destructive">Nu poate</Badge>}
                  </div>
                </div>
                <SelectMenu
                  id={`competition-category-${child.id}`}
                  value={props.choice[child.id] ?? ''}
                  onValueChange={(value) => props.onChoice(child.id, value)}
                  emptyLabel="Nu înscrie acest copil"
                  options={props.categoryOptions}
                  className="mt-3"
                />
                {verdict && !verdict.eligible && (
                  <p role="alert" className="text-destructive mt-2 text-sm">
                    {verdict.reason ?? 'Categoria nu este disponibilă pentru acest copil.'}
                  </p>
                )}
                <VerifiedPrice verdict={verdict} />
              </div>
            )
          })
        ))}

      <div
        className={cn('space-y-4 rounded-xl border p-4', self?.eligible && 'border-primary')}
        aria-label="Înscriere proprie"
        role="group"
      >
        <label className="flex min-h-touch-target items-center gap-3 font-semibold">
          <Checkbox
            checked={props.includeSelf}
            onChange={(event) => props.onIncludeSelf(event.target.checked)}
          />
          Mă înscriu eu
        </label>
        {props.includeSelf && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Data nașterii este folosită pentru categoria de vârstă la data înscrierii.
            </p>
            <div className="space-y-2">
              <Label htmlFor="competition-self-birth-date">Data mea de naștere</Label>
              <Input
                id="competition-self-birth-date"
                type="date"
                value={props.selfBirthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => props.onSelfBirthDate(event.target.value)}
                className="min-h-touch-target"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competition-self-category">Categoria mea</Label>
              <SelectMenu
                id="competition-self-category"
                value={props.selfCategoryId}
                onValueChange={props.onSelfCategory}
                emptyLabel="Alege categoria"
                options={props.categoryOptions}
              />
            </div>
            {self && !self.eligible && (
              <p role="alert" className="text-destructive text-sm">
                {self.reason ?? 'Categoria nu este disponibilă pentru tine.'}
              </p>
            )}
            <VerifiedPrice verdict={self} />
          </div>
        )}
      </div>

      {props.validationFailed && (
        <StatusView
          state="error"
          title="Nu am putut verifica eligibilitatea și prețul."
          onRetry={props.retryValidation}
        />
      )}
    </section>
  )
}
