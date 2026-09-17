import {
  schema,
  GOL,
  CAMP_FORM_STEPS,
  COSTURI_FIELDS,
  DETALII_FIELDS,
  type Values,
} from './camp-form-schema'
import { varsteDinDateSalvate } from './camp-form-totals'
import { offerCurrencyValues } from '@/lib/pricing/offer-currency'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check } from 'lucide-react'
import { toast } from 'sonner'

import { getCategoriile, getPreturilePeVarsta, getTabaraDeEditat } from '@/api/camps-admin'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'
import { readCampRequirements } from '@/lib/camp-requirements'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProprietarTabere } from './useProprietarTabere'
import type { CampPortalBaza } from './camp-portal'
import CampAgePricesSection from './CampAgePricesSection'
import CampFormDetailsStep from './CampFormDetailsStep'
import CampFormReviewStep from './CampFormReviewStep'

export default function CampFormPage({ baza }: { baza: CampPortalBaza }) {
  const { id } = useParams()
  const eEditare = !!id
  const { proprietar, gata, eClub } = useProprietarTabere()
  const [step, setStep] = useState(0)

  const { data: tabara, isError: eroareTabara } = useQuery({
    queryKey: ['tabara-de-editat', id],
    queryFn: () => getTabaraDeEditat(id as string),
    enabled: eEditare,
  })
  const { data: categorii, isSuccess: categoriiGata } = useQuery({
    queryKey: ['categoriile-taberei', id],
    queryFn: () => getCategoriile(id as string),
    enabled: eEditare,
  })
  const { data: varste, isSuccess: varsteGata } = useQuery({
    queryKey: ['preturile-pe-varsta', id],
    queryFn: () => getPreturilePeVarsta(id as string),
    enabled: eEditare,
  })
  const locatiaSalvata = tabara?.location_id ?? null
  const { data: locatii, isError: eroareLocatii } = useQuery({
    queryKey: ['locatii-pentru-tabara', proprietar.clubId, eClub, locatiaSalvata],
    queryFn: () =>
      eClub
        ? getClubSelectableLocations(proprietar.clubId as string, locatiaSalvata)
        : getSelectableLocations(),
    enabled: gata && (!eClub || !!proprietar.clubId) && (!eEditare || !!tabara),
  })
  const locatiiGata = !!locatii || eroareLocatii

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    trigger,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: GOL })

  useEffect(() => {
    if (tabara && categoriiGata && varsteGata && locatiiGata) {
      reset({
        ...offerCurrencyValues(tabara),
        title: tabara.title,
        slug: tabara.slug,
        period_start: tabara.period_start,
        period_end: tabara.period_end,
        location_id: tabara.location_id ?? '',
        location_text: tabara.location_text ?? '',
        capacity: tabara.capacity?.toString() ?? '',
        allow_cash: tabara.allow_cash,
        description: tabara.description ?? '',
        rules: tabara.rules ?? '',
        necesar: readCampRequirements(tabara.camp_requirements).map((categorie) => ({
          name: categorie.name,
          items: categorie.items.map((articol) => ({
            name: articol.name,
            quantity: String(articol.quantity),
          })),
        })),
        varste: varsteDinDateSalvate({
          agePrices: varste ?? [],
          priceItems: categorii ?? [],
          campPrice: tabara.price,
        }),
      })
    }
  }, [tabara, categorii, categoriiGata, varste, varsteGata, locatiiGata, reset])

  const currency = useWatch({ control, name: 'currency' })
  const slugViu = useWatch({ control, name: 'slug' })

  const inapoiLaPas = (urmatorul: number) => {
    if (urmatorul < step) setStep(urmatorul)
  }

  const next = async () => {
    if (step === 0) {
      if (await trigger([...DETALII_FIELDS])) setStep(1)
      return
    }
    if (step === 1) {
      if (await trigger([...COSTURI_FIELDS])) setStep(2)
    }
  }

  const onLocalDraft = () => {
    toast.success('Draft local păstrat. Salvarea în tabără urmează după acest prototip.')
  }

  const onInvalid = (invalide: FieldErrors<Values>) => {
    const primul = Object.keys(invalide)[0]
    if (DETALII_FIELDS.includes(primul as (typeof DETALII_FIELDS)[number])) setStep(0)
    else if (COSTURI_FIELDS.includes(primul as (typeof COSTURI_FIELDS)[number])) setStep(1)
  }

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (step < 2) void next()
    else void handleSubmit(onLocalDraft, onInvalid)()
  }

  if (eEditare && eroareTabara) {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca tabăra.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={baza}
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la tabere
      </Link>
      <h1 className="font-display mt-2 text-2xl font-bold">
        {eEditare ? 'Editează tabăra' : 'Tabără nouă'}
      </h1>
      <p
        role="status"
        className="border-border bg-muted text-muted-foreground mt-3 rounded-2xl border border-dashed p-4 text-sm"
      >
        Draft local — prototip pentru noul flux. Datele rămân în formular; nu se salvează încă în
        tabără.
      </p>

      <ol className="mt-6 mb-6 flex flex-wrap gap-2" aria-label="Pașii formularului">
        {CAMP_FORM_STEPS.map((label, i) => {
          const current = i === step
          const done = i < step
          const className = cn(
            'flex min-h-11 items-center gap-2 rounded-full px-3 py-1.5 text-sm',
            current
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'bg-muted text-muted-foreground',
          )
          const inner = (
            <>
              <span className="grid size-5 place-items-center rounded-full border text-xs">
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {label}
            </>
          )
          return (
            <li key={label}>
              {done ? (
                <button type="button" className={className} onClick={() => inapoiLaPas(i)}>
                  {inner}
                </button>
              ) : (
                <span className={className} aria-current={current ? 'step' : undefined}>
                  {inner}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <form onSubmit={onFormSubmit} className="space-y-5" noValidate>
        {step === 0 && (
          <CampFormDetailsStep
            register={register}
            control={control}
            setValue={setValue}
            errors={errors}
            eEditare={eEditare}
            eClub={eClub}
            locatii={locatii}
            eroareLocatii={eroareLocatii}
            slugViu={slugViu ?? ''}
            tabara={tabara}
          />
        )}
        {step === 1 && (
          <CampAgePricesSection
            control={control}
            register={register}
            errors={errors}
            currency={currency}
            proprietar={proprietar}
            campId={id}
            gata={gata}
          />
        )}
        {step === 2 && <CampFormReviewStep values={getValues()} locatii={locatii} />}

        <div className="flex flex-wrap gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 px-6"
              onClick={() => inapoiLaPas(step - 1)}
            >
              Înapoi
            </Button>
          )}
          <Button type="submit" className="h-11 min-h-11 px-6">
            {step < 2 ? 'Continuă' : 'Păstrează draftul local'}
          </Button>
        </div>
      </form>
    </div>
  )
}
