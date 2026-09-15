import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Values } from './camp-form-schema'

type Props = {
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
}

export default function CampRequirementsSection({ control, register, errors }: Props) {
  const categories = useFieldArray({ control, name: 'necesar' })

  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Necesar pentru tabără</legend>
      <p className="text-muted-foreground text-sm">
        Grupează lucrurile de adus și trece numărul fiecărui articol.
      </p>

      <ul className="mt-4 space-y-4" aria-label="Categorii necesar">
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

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-11 min-h-11"
        onClick={() => categories.append({ name: '', items: [] })}
      >
        <Plus className="size-4" /> Adaugă categorie
      </Button>
      {typeof errors.necesar?.message === 'string' && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {errors.necesar.message}
        </p>
      )}
    </fieldset>
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
  const categoryError = errors.necesar?.[categoryIndex]

  return (
    <li className="rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <Label htmlFor={`necesar-${categoryIndex}-name`} className="mb-1.5 block">
            Categorie
          </Label>
          <Input
            id={`necesar-${categoryIndex}-name`}
            {...register(`necesar.${categoryIndex}.name` as const)}
            className="h-11 lg:h-9"
            aria-invalid={!!categoryError?.name}
            placeholder="Haine"
          />
          {categoryError?.name?.message && (
            <p className="text-destructive mt-1 text-xs" role="alert">
              {categoryError.name.message}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-6 size-11 min-h-11 shrink-0"
          onClick={onRemove}
          aria-label={`Șterge categoria ${categoryIndex + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <ul className="mt-4 space-y-3" aria-label={`Articole categoria ${categoryIndex + 1}`}>
        {items.fields.map((item, itemIndex) => (
          <li key={item.id} className="flex items-start gap-3">
            <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_120px]">
              <div>
                <Label
                  htmlFor={`necesar-${categoryIndex}-item-${itemIndex}-name`}
                  className="mb-1.5 block"
                >
                  Articol
                </Label>
                <Input
                  id={`necesar-${categoryIndex}-item-${itemIndex}-name`}
                  {...register(`necesar.${categoryIndex}.items.${itemIndex}.name` as const)}
                  className="h-11 lg:h-9"
                  aria-invalid={!!categoryError?.items?.[itemIndex]?.name}
                  placeholder="Chiloți"
                />
                {categoryError?.items?.[itemIndex]?.name?.message && (
                  <p className="text-destructive mt-1 text-xs" role="alert">
                    {categoryError.items[itemIndex].name.message}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor={`necesar-${categoryIndex}-item-${itemIndex}-quantity`}
                  className="mb-1.5 block"
                >
                  Număr
                </Label>
                <Input
                  id={`necesar-${categoryIndex}-item-${itemIndex}-quantity`}
                  type="number"
                  min={1}
                  max={99}
                  {...register(`necesar.${categoryIndex}.items.${itemIndex}.quantity` as const)}
                  className="h-11 lg:h-9"
                  aria-invalid={!!categoryError?.items?.[itemIndex]?.quantity}
                />
                {categoryError?.items?.[itemIndex]?.quantity?.message && (
                  <p className="text-destructive mt-1 text-xs" role="alert">
                    {categoryError.items[itemIndex].quantity.message}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-6 size-11 min-h-11 shrink-0"
              onClick={() => items.remove(itemIndex)}
              aria-label={`Șterge articolul ${itemIndex + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-11 min-h-11"
        onClick={() => items.append({ name: '', quantity: '' })}
      >
        <Plus className="size-4" /> Adaugă articol
      </Button>
      {categoryError?.items?.message && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {categoryError.items.message}
        </p>
      )}
    </li>
  )
}
