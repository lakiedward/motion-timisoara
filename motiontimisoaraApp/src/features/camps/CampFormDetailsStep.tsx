import { Link } from 'react-router-dom'
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import CampFormField from './CampFormField'
import CampPeriodSection from './CampPeriodSection'
import CampPhotosSection from './CampPhotosSection'
import CampCoachesSection from './CampCoachesSection'
import CampRequirementsSection from './CampRequirementsSection'
import CampRulesSection from './CampRulesSection'
import { slugDinTitlu } from '@/api/camps-admin'
import type { Values } from './camp-form-schema'

type LocatieOptiune = { id: string; name: string; city: string | null }

export default function CampFormDetailsStep({
  register,
  control,
  setValue,
  errors,
  eEditare,
  eClub,
  locatii,
  eroareLocatii,
  slugViu,
  tabara,
}: {
  register: UseFormRegister<Values>
  control: Control<Values>
  setValue: UseFormSetValue<Values>
  errors: FieldErrors<Values>
  eEditare: boolean
  eClub: boolean
  locatii: LocatieOptiune[] | undefined
  eroareLocatii: boolean
  slugViu: string
  tabara: { id: string; hero_photo_storage_path: string | null } | null | undefined
}) {
  const titluReg = register('title')

  return (
    <section className="space-y-5" aria-labelledby="pas-detalii">
      <h2 id="pas-detalii" className="font-display text-lg font-bold">
        Detalii
      </h2>

      <CampFormField eticheta="Titlu" eroare={errors.title?.message}>
        <Input
          {...titluReg}
          className="h-11 lg:h-9"
          aria-invalid={!!errors.title}
          onBlur={(e) => {
            titluReg.onBlur(e)
            if (!eEditare && !slugViu) setValue('slug', slugDinTitlu(e.target.value))
          }}
        />
      </CampFormField>

      <CampFormField
        eticheta="Adresa paginii"
        eroare={errors.slug?.message}
        ajutor={`/tabere/${slugViu || '...'}`}
      >
        <Input {...register('slug')} className="h-11 lg:h-9" aria-invalid={!!errors.slug} />
      </CampFormField>

      <CampPeriodSection
        register={register}
        control={control}
        setValue={setValue}
        errors={errors}
      />

      <CampFormField
        eticheta="Loc"
        ajutor={
          eroareLocatii
            ? 'Nu am putut încărca locațiile. Poți salva tabăra și alege locul mai târziu.'
            : 'Un loc din platformă: așa ajunge tabăra pe hartă.'
        }
      >
        <select
          {...register('location_id')}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9"
        >
          <option value="">— fără loc ales —</option>
          {(locatii ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.city ? ` · ${l.city}` : ''}
            </option>
          ))}
        </select>
      </CampFormField>
      <Link
        to={eClub ? '/club/locations/new' : '/coach/locations/new'}
        className="text-primary inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
      >
        Locul nu e în listă? Adaugă o locație nouă, cu pin pe hartă
      </Link>

      <CampFormField
        eticheta="Detalii despre loc"
        ajutor="Text liber, se vede pe pagina publică: cabana, intrarea, punctul de întâlnire."
      >
        <Input {...register('location_text')} className="h-11 lg:h-9" />
      </CampFormField>

      <CampFormField eticheta="Locuri" ajutor="Lasă gol pentru tabără fără limită.">
        <Input type="number" min={0} {...register('capacity')} className="h-11 lg:h-9" />
      </CampFormField>

      <CampFormField eticheta="Descriere">
        <textarea
          {...register('description')}
          rows={4}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent p-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] [field-sizing:content] max-h-64"
        />
      </CampFormField>

      <CampRulesSection register={register} errors={errors} />

      <CampRequirementsSection control={control} register={register} errors={errors} />

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" {...register('allow_cash')} className="size-4" />
        Acceptă plata cash
      </label>

      {eEditare && tabara ? (
        <>
          <CampPhotosSection campId={tabara.id} heroCale={tabara.hero_photo_storage_path} />
          <CampCoachesSection campId={tabara.id} />
        </>
      ) : (
        <p className="text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
          Pozele și antrenorii se adaugă după ce tabăra există deja.
        </p>
      )}
    </section>
  )
}
