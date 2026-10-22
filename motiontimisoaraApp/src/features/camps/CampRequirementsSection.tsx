import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'

import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import CampFormField from './CampFormField'
import type { Values } from './camp-form-schema'
import {
  articoleCompletate,
  categorieNecesarNoua,
  etichetaArticole,
} from './camp-requirements-form'

type Props = {
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
}

export default function CampRequirementsSection({ control, register, errors }: Props) {
  const categories = useFieldArray({ control, name: 'necesar' })

  return (
    <FormSection
      title="Necesar pentru tabără"
      description="Grupează lucrurile de adus și trece numărul fiecărui articol. Părinții văd lista pe pagina taberei."
    >
      {categories.fields.length === 0 ? (
        <p className="bg-muted/50 text-muted-foreground rounded-lg px-4 py-3 text-sm">
          Lista e goală. Pagina taberei nu arată secțiunea „Necesar” până nu adaugi o categorie, de
          exemplu Haine sau Igienă.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="Categorii necesar">
          {categories.fields.map((category, categoryIndex) => (
            <CampRequirementCategoryEditor
              key={category.id}
              categoryIndex={categoryIndex}
              control={control}
              register={register}
              errors={errors}
              onRemove={() => categories.remove(categoryIndex)}
            />
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 min-h-11"
        onClick={() => categories.append(categorieNecesarNoua())}
      >
        <Plus className="size-4" /> Adaugă categorie
      </Button>
      {typeof errors.necesar?.message === 'string' && (
        <p className="text-destructive text-sm" role="alert">
          {errors.necesar.message}
        </p>
      )}
    </FormSection>
  )
}

function CampRequirementCategoryEditor({
  categoryIndex,
  control,
  register,
  errors,
  onRemove,
}: Props & { categoryIndex: number; onRemove: () => void }) {
  const items = useFieldArray({ control, name: `necesar.${categoryIndex}.items` as const })
  const category = useWatch({ control, name: `necesar.${categoryIndex}` as const })
  const [confirmare, setConfirmare] = useState(false)
  const categoryError = errors.necesar?.[categoryIndex]
  const numeCategorie = category?.name?.trim() || `Categoria ${categoryIndex + 1}`
  const completate = articoleCompletate(category?.items)

  return (
    <li className="rounded-xl border p-4" aria-label={`Categoria ${categoryIndex + 1}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="min-w-0 font-semibold break-words">
          {numeCategorie}
          <span className="text-muted-foreground font-normal">
            {' '}
            · {etichetaArticole(completate)}
          </span>
        </h3>
        <Button
          type="button"
          variant="ghost"
          className="size-11 min-h-11 shrink-0"
          onClick={() => (completate > 0 ? setConfirmare(true) : onRemove())}
          aria-label={`Șterge categoria ${categoryIndex + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <CampFormField obligatoriu eticheta="Categorie" eroare={categoryError?.name?.message}>
        <Input
          {...register(`necesar.${categoryIndex}.name` as const)}
          aria-invalid={!!categoryError?.name}
          placeholder="ex. Haine"
        />
      </CampFormField>

      <ul className="mt-4 space-y-3" aria-label={`Articole categoria ${categoryIndex + 1}`}>
        {items.fields.map((item, itemIndex) => (
          <li
            key={item.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
          >
            <div className="col-span-2 sm:col-span-1">
              <CampFormField
                obligatoriu
                eticheta="Articol"
                eroare={categoryError?.items?.[itemIndex]?.name?.message}
              >
                <Input
                  {...register(`necesar.${categoryIndex}.items.${itemIndex}.name` as const)}
                  aria-invalid={!!categoryError?.items?.[itemIndex]?.name}
                  placeholder="ex. Tricouri"
                />
              </CampFormField>
            </div>
            <div>
              <CampFormField
                obligatoriu
                eticheta="Număr"
                eroare={categoryError?.items?.[itemIndex]?.quantity?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  {...register(`necesar.${categoryIndex}.items.${itemIndex}.quantity` as const)}
                  aria-invalid={!!categoryError?.items?.[itemIndex]?.quantity}
                />
              </CampFormField>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-[1.375rem] size-11 min-h-11 shrink-0"
              disabled={items.fields.length <= 1}
              onClick={() => items.remove(itemIndex)}
              aria-label={`Șterge articolul ${itemIndex + 1}, categoria ${categoryIndex + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="mt-3 h-11 min-h-11"
        onClick={() => items.append({ name: '', quantity: '1' })}
      >
        <Plus className="size-4" /> Adaugă articol
      </Button>
      {categoryError?.items?.message && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {categoryError.items.message}
        </p>
      )}

      <ConfirmDialog
        open={confirmare}
        onOpenChange={setConfirmare}
        title={`Ștergi categoria „${numeCategorie}”?`}
        description={`Se scot și cele ${etichetaArticole(completate)} din ea. Schimbarea rămâne doar în formular până salvezi tabăra.`}
        confirmLabel="Șterge categoria"
        destructive
        onConfirm={() => {
          setConfirmare(false)
          onRemove()
        }}
      />
    </li>
  )
}
