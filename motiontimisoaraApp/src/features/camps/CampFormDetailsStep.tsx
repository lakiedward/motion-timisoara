import { Link } from 'react-router-dom'
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { FormSection, RequiredFieldsNote } from '@/components/FormSection'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import CampFormField from './CampFormField'
import CampPeriodSection from './CampPeriodSection'
import CampPhotosSection from './CampPhotosSection'
import CampCoachesSection from './CampCoachesSection'
import CampRequirementsSection from './CampRequirementsSection'
import CampRulesSection from './CampRulesSection'
import { slugDinTitlu } from '@/api/camps-admin'
import { HeroPhotoField } from '@/components/HeroPhotoField'
import type { CampRulesFileMeta } from '@/lib/camp-rules'
import type { Values } from './camp-form-schema'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-2 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

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
  fisierSalvat,
  fisierLocal,
  onFisierLocal,
  eroareHero,
  onPozaHero,
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
  fisierSalvat: CampRulesFileMeta | null
  fisierLocal: File | null
  onFisierLocal: (fisier: File | null) => void
  eroareHero: string | null
  onPozaHero: (fisier: File) => void
}) {
  const titluReg = register('title')

  return (
    <section className="space-y-5" aria-labelledby="pas-detalii">
      <div>
        <h2 id="pas-detalii" className="font-display text-lg font-bold">
          Detalii
        </h2>
        <RequiredFieldsNote />
      </div>

      <FormSection title="Despre tabără" description="Numele și textul pe care le vede părintele.">
        <CampFormField obligatoriu eticheta="Titlu" eroare={errors.title?.message}>
          <Input
            {...titluReg}
            aria-invalid={!!errors.title}
            onBlur={(e) => {
              titluReg.onBlur(e)
              if (!eEditare && !slugViu) setValue('slug', slugDinTitlu(e.target.value))
            }}
          />
        </CampFormField>

        <CampFormField
          obligatoriu
          eticheta="Adresa paginii"
          eroare={errors.slug?.message}
          ajutor={`/tabere/${slugViu || '...'}`}
        >
          <Input {...register('slug')} aria-invalid={!!errors.slug} />
        </CampFormField>

        <CampFormField eticheta="Descriere">
          <Textarea
            {...register('description')}
            rows={4}
            className="[field-sizing:content] max-h-64"
          />
        </CampFormField>
      </FormSection>

      <CampPeriodSection
        register={register}
        control={control}
        setValue={setValue}
        errors={errors}
      />

      <FormSection title="Loc și locuri" description="Unde are loc tabăra și câți copii primești.">
        <CampFormField
          eticheta="Loc"
          ajutor={
            eroareLocatii
              ? 'Nu am putut încărca locațiile. Poți salva tabăra și alege locul mai târziu.'
              : 'Un loc din platformă: așa ajunge tabăra pe hartă.'
          }
        >
          <select {...register('location_id')} className={selectCls}>
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
          className="text-primary -mt-2 inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        >
          Locul nu e în listă? Adaugă o locație nouă, cu pin pe hartă
        </Link>

        <CampFormField
          eticheta="Detalii despre loc"
          ajutor="Text liber, se vede pe pagina publică: cabana, intrarea, punctul de întâlnire."
        >
          <Input {...register('location_text')} />
        </CampFormField>

        <CampFormField eticheta="Locuri" ajutor="Lasă gol pentru tabără fără limită.">
          <Input type="number" min={0} {...register('capacity')} />
        </CampFormField>
      </FormSection>

      <CampRulesSection
        register={register}
        errors={errors}
        campId={tabara?.id}
        fisierSalvat={fisierSalvat}
        fisierLocal={fisierLocal}
        onFisierLocal={onFisierLocal}
      />

      <CampRequirementsSection control={control} register={register} errors={errors} />

      <FormSection title="Plată" description="Pe lângă plata cu cardul.">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" {...register('allow_cash')} className="size-4" />
          Acceptă plata cash
        </label>
      </FormSection>

      {eEditare && tabara ? (
        <>
          {eroareHero && (
            <p id="camp-hero" className="text-destructive text-sm" role="alert">
              {eroareHero}
            </p>
          )}
          <CampPhotosSection campId={tabara.id} heroCale={tabara.hero_photo_storage_path} />
          <CampCoachesSection campId={tabara.id} />
        </>
      ) : (
        <FormSection
          id="camp-hero"
          title="Poza din capul paginii"
          description="Obligatorie. Se vede în banda de deasupra titlului, pe pagina publică. Galeria și antrenorii se adaugă după ce tabăra există."
        >
          <HeroPhotoField framed={false} savedUrl={null} error={eroareHero} onFile={onPozaHero} />
        </FormSection>
      )}
    </section>
  )
}
