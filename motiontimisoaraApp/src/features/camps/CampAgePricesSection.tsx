import { CircleAlert, Plus, Trash2 } from 'lucide-react'
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

import {
  getPretulAdult,
  getPreturilePeVarsta,
  getTaberelemele,
  type Proprietar,
} from '@/api/camps-admin'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { selectClassName } from '@/components/ui/field-styles'
import { OfferCurrencyFields } from '@/components/OfferCurrencyFields'
import { spreAdult, spreCamp, type Values } from './camp-form-schema'
import {
  categorieNoua,
  etichetaVarsta,
  mesajVarsteNeacoperite,
  varsteNeacoperite,
} from './camp-form-totals'
import CampFormField from './CampFormField'
import { CampPriceComponents } from './CampPriceComponents'

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
  const avertismentVarste = mesajVarsteNeacoperite(varsteNeacoperite(varsteVii))
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

      <FormSection title="Moneda" description="În ce monedă plătește părintele toată tabăra.">
        <OfferCurrencyFields
          currency={currency}
          currencyField={register('currency')}
          setValue={setValue}
        />
      </FormSection>

      <FormSection
        title="Prețul pe categorie de vârstă"
        description="Fiecare categorie are componente de cost, de exemplu cazare, masă și antrenamente. Totalul se calculează singur. Vârsta e în ani împliniți la începutul taberei, capete incluse."
      >
        {surseDeCopiat.length > 0 && (
          <CampFormField eticheta="Copiază categoriile din altă tabără">
            <select
              defaultValue=""
              onChange={(e) => {
                void copiazaDin(e.target.value)
                e.target.value = ''
              }}
              className={selectClassName}
            >
              <option value="">alege o tabără…</option>
              {surseDeCopiat.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </CampFormField>
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

        <ul className="space-y-3" aria-label="Categorii de vârstă">
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

        {avertismentVarste && (
          <p className="text-highlight-ink flex items-start gap-2 text-sm" role="status">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {avertismentVarste}
          </p>
        )}

        {errors.varste?.root?.message && (
          <p className="text-destructive text-sm" role="alert">
            {errors.varste.root.message}
          </p>
        )}
        {typeof errors.varste?.message === 'string' && (
          <p className="text-destructive text-sm" role="alert">
            {errors.varste.message}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => varsteArr.append(categorieNoua())}
        >
          <Plus className="size-4" /> Adaugă o categorie de vârstă
        </Button>
      </FormSection>

      <FormSection
        title="Tarif adult"
        description="Părintele se poate înscrie cu același tip de componente. Un adult ocupă un loc din capacitate, ca un copil."
      >
        <CampPriceComponents
          name="adult.componente"
          control={control}
          register={register}
          errors={errors.adult?.componente as never}
          currency={currency}
          eticheta="Componentă adult"
          etichetaSuma="Sumă adult"
          textAdauga="Adaugă o componentă adult"
          textGratuit="Adult gratuit"
          ariaPrefix="tarif adult"
        />
      </FormSection>
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
  const eroriCategorie = errors.varste?.[index]
  const categorie = useWatch({ control, name: `varste.${index}` })
  return (
    <li className="rounded-xl border p-4" aria-label={`Categoria de vârstă ${index + 1}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          Categoria {index + 1} · {etichetaVarsta(categorie?.age_from, categorie?.age_to)}
        </h3>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            className="size-11 min-h-11"
            onClick={onRemove}
            aria-label={`Șterge categoria de vârstă ${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CampFormField eticheta="De la (ani)" eroare={eroriCategorie?.age_from?.message}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={25}
            {...register(`varste.${index}.age_from`)}
            aria-invalid={!!eroriCategorie?.age_from}
          />
        </CampFormField>
        <div>
          <CampFormField eticheta="Până la (ani)" eroare={eroriCategorie?.age_to?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={25}
              {...register(`varste.${index}.age_to`)}
              aria-invalid={!!eroriCategorie?.age_to}
            />
          </CampFormField>
        </div>
      </div>
      <div className="mt-4">
        <CampPriceComponents
          name={`varste.${index}.componente`}
          control={control}
          register={register}
          errors={eroriCategorie?.componente as never}
          currency={currency}
          eticheta="Componentă"
          etichetaSuma="Sumă"
          textAdauga="Adaugă o componentă"
          textGratuit="Marchează gratuit"
          ariaPrefix={`categoria ${index + 1}`}
        />
      </div>
    </li>
  )
}
