import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { toast } from 'sonner'

import { getPreturilePeVarsta, getTaberelemele, type Proprietar } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseScaledDecimal } from '@/lib/pricing/offer-currency'
import { spreCamp, type Values } from './camp-form-schema'
import CampFormField from './CampFormField'

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
  const modPret = useWatch({ control, name: 'pricing_mode' })
  const varsteVii = useWatch({ control, name: 'varste' })
  const peVarsta = modPret === 'by_age'
  const { data: taberele, isError: eroareTabere, refetch: reincarcaTaberele } = useQuery({
    queryKey: ['taberele-mele', proprietar.clubId, proprietar.coachUserId],
    queryFn: () => getTaberelemele(proprietar),
    enabled: gata && peVarsta,
  })
  const surseDeCopiat = (taberele ?? []).filter(
    (t) => t.id !== campId && t.pricing_mode === 'by_age' && t.currency === currency,
  )

  const copiazaDin = async (sursaId: string) => {
    if (!sursaId) return
    try {
      const randuri = await getPreturilePeVarsta(sursaId)
      varsteArr.replace(randuri.map(spreCamp))
    } catch {
      toast.error('Nu am putut citi categoriile taberei alese.')
    }
  }

  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Prețul pe vârstă</legend>

      <div className="space-y-1" role="radiogroup" aria-label="Cum se stabilește prețul">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="radio" value="single" {...register('pricing_mode')} className="size-4" />
          Preț unic — toți copiii plătesc prețul taberei
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="radio" value="by_age" {...register('pricing_mode')} className="size-4" />
          Pe categorii de vârstă — fiecare copil plătește suma categoriei lui
        </label>
      </div>

      {peVarsta && (
        <>
          <p className="text-muted-foreground mt-4 text-sm">
            Vârsta se socotește în ani împliniți la data de început a taberei, iar capetele
            intervalului sunt incluse. Un copil care nu intră în nicio categorie nu se va putea
            înscrie. 0 lei înseamnă gratuit pentru acea categorie; intervalul îl alegi tu, de
            exemplu 0–2 ani. Părintele vede Gratuit sau suma categoriei și confirmă totalul înainte
            de plată.
          </p>

          <ul className="mt-4 space-y-4" aria-label="Categorii de vârstă">
            {varsteArr.fields.map((f, i) => {
              const gratuit = parseScaledDecimal(varsteVii?.[i]?.amount_lei ?? '', 2) === 0
              return (
                <li key={f.id} className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid flex-1 gap-3 sm:grid-cols-3">
                      <CampFormField
                        eticheta="De la (ani)"
                        eroare={errors.varste?.[i]?.age_from?.message}
                      >
                        <Input
                          type="number"
                          min={0}
                          max={25}
                          {...register(`varste.${i}.age_from`)}
                          className="h-11 lg:h-9"
                          aria-invalid={!!errors.varste?.[i]?.age_from}
                        />
                      </CampFormField>
                      <CampFormField
                        eticheta="Până la (ani)"
                        eroare={errors.varste?.[i]?.age_to?.message}
                      >
                        <Input
                          type="number"
                          min={0}
                          max={25}
                          {...register(`varste.${i}.age_to`)}
                          className="h-11 lg:h-9"
                          aria-invalid={!!errors.varste?.[i]?.age_to}
                        />
                      </CampFormField>
                      <CampFormField
                        eticheta={`Sumă (${currency === 'EUR' ? 'EUR' : 'lei'})`}
                        eroare={errors.varste?.[i]?.amount_lei?.message}
                        ajutor={gratuit ? 'Categoria este gratuită.' : undefined}
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...register(`varste.${i}.amount_lei`)}
                          className="h-11 lg:h-9"
                          aria-invalid={!!errors.varste?.[i]?.amount_lei}
                        />
                      </CampFormField>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 min-h-11 shrink-0"
                      onClick={() => varsteArr.remove(i)}
                      aria-label={`Șterge categoria de vârstă ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-11 min-h-11"
                    onClick={() =>
                      setValue(`varste.${i}.amount_lei`, '0', {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    Marchează gratuit
                  </Button>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => varsteArr.append({ age_from: '', age_to: '', amount_lei: '' })}
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
                <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => void reincarcaTaberele()}>
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
        </>
      )}
    </fieldset>
  )
}
