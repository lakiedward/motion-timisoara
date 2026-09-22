import { Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { toast } from 'sonner'

import { getPretulAdult, getPreturilePeVarsta, getTaberelemele, type Proprietar } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OfferCurrencyFields } from '@/components/OfferCurrencyFields'
import { formatOfferPrice } from '@/lib/money'
import { spreAdult, spreCamp, type Values } from './camp-form-schema'
import { categorieNoua, totalCategorieBani } from './camp-form-totals'
import CampFormField, { campFormRandAction, CampFormRand } from './CampFormField'

type Props = {
  control: Control<Values>
  register: UseFormRegister<Values>
  setValue: UseFormSetValue<Values>
  errors: FieldErrors<Values>
  currency: string
  proprietar: Proprietar
  campId?: string
  gata: boolean
}

export default function CampAgePricesSection({
  control,
  register,
  setValue,
  errors,
  currency,
  proprietar,
  campId,
  gata,
}: Props) {
  const varsteArr = useFieldArray({ control, name: 'varste' })
  const varsteVii = useWatch({ control, name: 'varste' })
  const {
    data: taberele,
    isError: eroareTabere,
    refetch: reincarcaTaberele,
  } = useQuery({
    queryKey: ['taberele-mele', proprietar.clubId, proprietar.coachUserId],
    queryFn: () => getTaberelemele(proprietar),
    enabled: gata,
  })
  const surseDeCopiat = (taberele ?? []).filter(
    (t) => t.id !== campId && t.pricing_mode === 'by_age' && t.currency === currency,
  )

  const copiazaDin = async (sursaId: string) => {
    if (!sursaId) return
    try {
      const [randuri, adult] = await Promise.all([
        getPreturilePeVarsta(sursaId),
        getPretulAdult(sursaId),
      ])
      varsteArr.replace(randuri.map(spreCamp))
      if (adult) setValue('adult', spreAdult(adult))
    } catch {
      toast.error('Nu am putut citi categoriile taberei alese.')
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="pas-costuri">
      <h2 id="pas-costuri" className="font-display text-lg font-bold">
        Categorii și costuri
      </h2>

      <fieldset className="rounded-2xl border p-5">
        <legend className="px-2 font-semibold">Prețul pe categorie de vârstă</legend>
        <p className="text-muted-foreground text-sm">
          Fiecare categorie are componente de cost — de exemplu cazare, masă și antrenamente; tu
          alegi numele. Totalul se calculează din componente, nu se introduce separat. 0 lei
          înseamnă gratuit. Vârsta e în ani împliniți la începutul taberei, capete incluse.
        </p>

        <div className="mt-4">
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
          />
        </div>

        <ul className="mt-4 space-y-4" aria-label="Categorii de vârstă">
          {varsteArr.fields.map((f, i) => (
            <CampAgeCategoryEditor
              key={f.id}
              index={i}
              control={control}
              register={register}
              errors={errors}
              currency={currency}
              canRemove={varsteArr.fields.length > 1}
              onRemove={() => varsteArr.remove(i)}
            />
          ))}
        </ul>

        <CampAdultPriceEditor control={control} register={register} errors={errors} currency={currency} />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => varsteArr.append(categorieNoua())}
          >
            <Plus className="size-4" /> Adaugă o categorie de vârstă
          </Button>

          {surseDeCopiat.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Copiază categoriile din</span>
              <select
                aria-label="Copiază categoriile din altă tabără"
                defaultValue=""
                onChange={(e) => {
                  void copiazaDin(e.target.value)
                  e.target.value = ''
                }}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9"
              >
                <option value="">alege o tabără…</option>
                {surseDeCopiat.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {eroareTabere && (
            <div className="flex flex-wrap items-center gap-2 text-sm" role="alert">
              <span>Nu am putut încărca taberele din care poți copia.</span>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                onClick={() => void reincarcaTaberele()}
              >
                Reîncearcă
              </Button>
            </div>
          )}
        </div>

        {errors.varste?.root?.message && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {errors.varste.root.message}
          </p>
        )}
        {typeof errors.varste?.message === 'string' && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {errors.varste.message}
          </p>
        )}
        {varsteVii?.length === 0 && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            Prețul pe categorii are nevoie de cel puțin o categorie de vârstă
          </p>
        )}
      </fieldset>
    </section>
  )
}

function CampAgeCategoryEditor({
  index,
  control,
  register,
  errors,
  currency,
  canRemove,
  onRemove,
}: {
  index: number
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
  currency: string
  canRemove: boolean
  onRemove: () => void
}) {
  const componenteArr = useFieldArray({ control, name: `varste.${index}.componente` })
  const componenteVii = useWatch({ control, name: `varste.${index}.componente` })
  const total = totalCategorieBani(componenteVii)
  const gratuit = total === 0
  const moneda = currency === 'EUR' ? 'EUR' : 'lei'
  const eroriCategorie = errors.varste?.[index]

  return (
    <li className="rounded-xl border p-4" aria-label={`Categoria de vârstă ${index + 1}`}>
      <div className="flex items-start gap-3">
        <CampFormRand columns="ages">
          <CampFormField rand eticheta="De la (ani)" eroare={eroriCategorie?.age_from?.message}>
            <Input
              type="number"
              min={0}
              max={25}
              {...register(`varste.${index}.age_from`)}
              className="h-11 lg:h-9"
              aria-invalid={!!eroriCategorie?.age_from}
            />
          </CampFormField>
          <CampFormField rand eticheta="Până la (ani)" eroare={eroriCategorie?.age_to?.message}>
            <Input
              type="number"
              min={0}
              max={25}
              {...register(`varste.${index}.age_to`)}
              className="h-11 lg:h-9"
              aria-invalid={!!eroriCategorie?.age_to}
            />
          </CampFormField>
        </CampFormRand>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            className="size-11 min-h-11 shrink-0"
            onClick={onRemove}
            aria-label={`Șterge categoria de vârstă ${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <ul className="mt-3 space-y-3" aria-label={`Componente de cost, categoria ${index + 1}`}>
        {componenteArr.fields.map((f, j) => (
          <li key={f.id}>
            <CampFormRand columns="amount">
              <CampFormField
                rand
                eticheta="Componentă"
                eroare={eroriCategorie?.componente?.[j]?.name?.message}
              >
                <Input
                  {...register(`varste.${index}.componente.${j}.name`)}
                  className="h-11 lg:h-9"
                  placeholder="ex. Cazare"
                  aria-invalid={!!eroriCategorie?.componente?.[j]?.name}
                />
              </CampFormField>
              <CampFormField
                rand
                eticheta={`Sumă (${moneda})`}
                eroare={eroriCategorie?.componente?.[j]?.amount_lei?.message}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register(`varste.${index}.componente.${j}.amount_lei`)}
                  className="h-11 lg:h-9"
                  aria-invalid={!!eroriCategorie?.componente?.[j]?.amount_lei}
                />
              </CampFormField>
              <Button
                type="button"
                variant="ghost"
                className={campFormRandAction}
                disabled={componenteArr.fields.length <= 1}
                onClick={() => componenteArr.remove(j)}
                aria-label={`Șterge componenta ${j + 1} din categoria ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </CampFormRand>
          </li>
        ))}
      </ul>
      {typeof eroriCategorie?.componente?.message === 'string' && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {eroriCategorie.componente.message}
        </p>
      )}

      <p className="mt-3 text-sm font-medium" aria-live="polite">
        Total {formatOfferPrice(total, currency)}
        {gratuit ? ' — categoria este gratuită.' : ''}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => componenteArr.append({ name: '', amount_lei: '' })}
        >
          <Plus className="size-4" /> Adaugă o componentă
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => componenteArr.replace([{ name: 'Participare', amount_lei: '0' }])}
        >
          Marchează gratuit
        </Button>
      </div>
    </li>
  )
}

function CampAdultPriceEditor({
  control,
  register,
  errors,
  currency,
}: {
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
  currency: string
}) {
  const componenteArr = useFieldArray({ control, name: 'adult.componente' })
  const componenteVii = useWatch({ control, name: 'adult.componente' })
  const total = totalCategorieBani(componenteVii)
  const gratuit = total === 0
  const moneda = currency === 'EUR' ? 'EUR' : 'lei'
  const erori = errors.adult

  return (
    <div className="mt-4 rounded-xl border p-4" aria-label="Tarif adult">
      <h3 className="font-semibold">Tarif adult</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Părintele se poate înscrie cu același tip de componente. 0 înseamnă Gratuit. Un adult ocupă
        un loc din capacitate, ca un copil.
      </p>
      <ul className="mt-3 space-y-3" aria-label="Componente tarif adult">
        {componenteArr.fields.map((f, j) => (
          <li key={f.id}>
            <CampFormRand columns="amount">
              <CampFormField
                rand
                eticheta="Componentă adult"
                eroare={erori?.componente?.[j]?.name?.message}
              >
                <Input
                  {...register(`adult.componente.${j}.name`)}
                  className="h-11 lg:h-9"
                  placeholder="ex. Participare"
                  aria-invalid={!!erori?.componente?.[j]?.name}
                />
              </CampFormField>
              <CampFormField
                rand
                eticheta={`Sumă adult (${moneda})`}
                eroare={erori?.componente?.[j]?.amount_lei?.message}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register(`adult.componente.${j}.amount_lei`)}
                  className="h-11 lg:h-9"
                  aria-invalid={!!erori?.componente?.[j]?.amount_lei}
                />
              </CampFormField>
              <Button
                type="button"
                variant="ghost"
                className={campFormRandAction}
                disabled={componenteArr.fields.length <= 1}
                onClick={() => componenteArr.remove(j)}
                aria-label={`Șterge componenta adult ${j + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </CampFormRand>
          </li>
        ))}
      </ul>
      {typeof erori?.componente?.message === 'string' && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {erori.componente.message}
        </p>
      )}
      <p className="mt-3 text-sm font-medium" aria-live="polite">
        Total adult {formatOfferPrice(total, currency)}
        {gratuit ? ' — tariful adult este gratuit.' : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => componenteArr.append({ name: '', amount_lei: '' })}
        >
          <Plus className="size-4" /> Adaugă o componentă adult
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => componenteArr.replace([{ name: 'Participare', amount_lei: '0' }])}
        >
          Adult gratuit
        </Button>
      </div>
    </div>
  )
}
