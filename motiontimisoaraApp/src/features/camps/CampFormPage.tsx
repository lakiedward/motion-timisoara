import { cloneElement, isValidElement, useEffect, useId } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  actualizeazaTabara,
  creeazaTabara,
  getCategoriile,
  getPreturilePeVarsta,
  getTabaraDeEditat,
  getTaberelemele,
  intervaleSuprapuse,
  salveazaBanii,
  salveazaPreturilePeVarsta,
  slugDinTitlu,
  type ModPret,
} from '@/api/camps-admin'
import { baniToRon, formatRon, ronToBani } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProprietarTabere } from './useProprietarTabere'
import CampPhotosSection from './CampPhotosSection'
import CampCoachesSection from './CampCoachesSection'

const lei = z
  .string()
  .refine((s) => s.trim() !== '' && !Number.isNaN(Number(s)) && Number(s) >= 0, 'Sumă invalidă')

// Ani împliniți, 0–25, ca poarta din bază (00037).
const ani = z
  .string()
  .refine(
    (s) => s.trim() !== '' && Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 25,
    'Între 0 și 25 de ani',
  )

const schema = z
  .object({
    pricing_mode: z.enum(['single', 'by_age']),
    varste: z.array(
      z
        .object({
          age_from: ani,
          age_to: ani,
          amount_lei: lei,
        })
        .refine((c) => Number(c.age_from) <= Number(c.age_to), {
          message: 'Vârsta de început e după cea de sfârșit',
          path: ['age_to'],
        }),
    ),
    title: z.string().min(3, 'Minim 3 caractere'),
    slug: z
      .string()
      .min(3, 'Minim 3 caractere')
      .regex(/^[a-z0-9-]+$/, 'Doar litere mici, cifre și cratime'),
    period_start: z.string().min(1, 'Alege data de început'),
    period_end: z.string().min(1, 'Alege data de sfârșit'),
    location_text: z.string().optional(),
    capacity: z.string().optional(),
    price_lei: lei,
    allow_cash: z.boolean(),
    description: z.string().optional(),
    categorii: z.array(
      z.object({
        name: z.string().min(1, 'Numele lipsește'),
        amount_lei: lei,
        description: z.string().optional(),
      }),
    ),
  })
  .refine((v) => v.period_end >= v.period_start, {
    message: 'Sfârșitul nu poate fi înaintea începutului',
    path: ['period_end'],
  })
  // Aceeași regulă ca poarta din bază, verificată aici doar ca omul să afle
  // înainte de drumul până la server. Baza rămâne cea care refuză de-adevăratelea.
  .refine(
    (v) =>
      v.categorii.length === 0 ||
      ronToBani(Number(v.price_lei)) ===
        v.categorii.reduce((t, c) => t + ronToBani(Number(c.amount_lei) || 0), 0),
    { message: 'Suma categoriilor trebuie să dea exact prețul taberei', path: ['categorii'] },
  )
  // Regulile prețului pe vârstă, aceleași ca în `salveaza_preturile_pe_varsta`:
  // „pe categorii" cere măcar una, iar intervalele nu se suprapun (capete incluse).
  .superRefine((v, ctx) => {
    if (v.pricing_mode !== 'by_age') return
    if (v.varste.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prețul pe categorii are nevoie de cel puțin o categorie de vârstă',
        path: ['varste'],
      })
      return
    }
    const perechi = v.varste.map((c) => ({ age_from: Number(c.age_from), age_to: Number(c.age_to) }))
    const suprapuse = intervaleSuprapuse(perechi)
    if (suprapuse) {
      const [a, b] = suprapuse
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Categoria ${perechi[a].age_from}–${perechi[a].age_to} ani se suprapune cu ${perechi[b].age_from}–${perechi[b].age_to} ani`,
        path: ['varste'],
      })
    }
  })

type Values = z.infer<typeof schema>

const GOL: Values = {
  title: '',
  slug: '',
  period_start: '',
  period_end: '',
  location_text: '',
  capacity: '',
  price_lei: '',
  allow_cash: false,
  description: '',
  categorii: [],
  pricing_mode: 'single',
  varste: [],
}

const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

/** O categorie de vârstă cum vine din bază, adusă în forma câmpurilor. */
const spreCamp = (c: { age_from: number; age_to: number; amount: number }) => ({
  age_from: String(c.age_from),
  age_to: String(c.age_to),
  amount_lei: String(baniToRon(c.amount)),
})

export default function CampFormPage({ baza }: { baza: '/club/camps' | '/coach/camps' }) {
  const { id } = useParams()
  const eEditare = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { proprietar, gata } = useProprietarTabere()

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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: GOL })

  const { fields, append, remove } = useFieldArray({ control, name: 'categorii' })
  const varsteArr = useFieldArray({ control, name: 'varste' })
  const titluReg = register('title')

  useEffect(() => {
    if (tabara && categoriiGata && varsteGata) {
      reset({
        title: tabara.title,
        slug: tabara.slug,
        period_start: tabara.period_start,
        period_end: tabara.period_end,
        location_text: tabara.location_text ?? '',
        capacity: tabara.capacity?.toString() ?? '',
        price_lei: String(baniToRon(tabara.price)),
        allow_cash: tabara.allow_cash,
        description: tabara.description ?? '',
        categorii: (categorii ?? []).map((c) => ({
          name: c.name,
          amount_lei: String(baniToRon(c.amount)),
          description: c.description ?? '',
        })),
        pricing_mode: (tabara.pricing_mode as ModPret) ?? 'single',
        varste: (varste ?? []).map(spreCamp),
      })
    }
  }, [tabara, categorii, categoriiGata, varste, varsteGata, reset])

  // `useWatch` în loc de `watch()`: doar câmpurile astea mișcă totalul de
  // sub categorii, deci restul formularului nu se mai randează la fiecare tastă.
  const pretLei = useWatch({ control, name: 'price_lei' })
  const categoriiVii = useWatch({ control, name: 'categorii' })
  const slugViu = useWatch({ control, name: 'slug' })
  const modPret = useWatch({ control, name: 'pricing_mode' })
  const peVarsta = modPret === 'by_age'

  // Sursele pentru „copiază categoriile din altă tabără": celelalte tabere ale
  // aceluiași proprietar. Decis 2026-09-02: fără șabloane de club sau de
  // platformă — categoriile stau pe tabără și se copiază, nu se sincronizează.
  const { data: taberele } = useQuery({
    queryKey: ['taberele-mele', proprietar.clubId, proprietar.coachUserId],
    queryFn: () => getTaberelemele(proprietar),
    enabled: gata && peVarsta,
  })
  const surseDeCopiat = (taberele ?? []).filter((t) => t.id !== id && t.pricing_mode === 'by_age')

  const copiazaDin = async (campId: string) => {
    if (!campId) return
    try {
      const randuri = await getPreturilePeVarsta(campId)
      varsteArr.replace(randuri.map(spreCamp))
    } catch {
      toast.error('Nu am putut citi categoriile taberei alese.')
    }
  }

  const pretBani = ronToBani(Number(pretLei) || 0)
  const sumaBani = (categoriiVii ?? []).reduce(
    (t, c) => t + ronToBani(Number(c?.amount_lei) || 0),
    0,
  )
  const areCategorii = (categoriiVii ?? []).length > 0
  const seDiferenta = areCategorii ? sumaBani - pretBani : 0

  const onSubmit = async (v: Values) => {
    if (!gata) return
    const campuri = {
      title: v.title,
      slug: v.slug,
      description: v.description?.trim() ? v.description : null,
      period_start: v.period_start,
      period_end: v.period_end,
      location_text: v.location_text?.trim() ? v.location_text : null,
      capacity: num(v.capacity),
      allow_cash: v.allow_cash,
    }
    const bani = v.categorii.map((c) => ({
      name: c.name.trim(),
      amount: ronToBani(Number(c.amount_lei)),
      description: c.description?.trim() ? c.description : null,
    }))

    try {
      // Prețul NU merge prin `campuri`: un UPDATE care îl schimbă singur e oprit
      // de triggerul din bază cât timp există categorii care nu l-ar mai da.
      // Se scrie împreună cu ele, prin funcție.
      const campId = eEditare
        ? (await actualizeazaTabara(id as string, campuri)).id
        : (await creeazaTabara(proprietar, campuri)).id
      await salveazaBanii(campId, ronToBani(Number(v.price_lei)), bani)
      // Comutatorul și categoriile de vârstă merg tot prin funcție, tot împreună.
      // Pe „preț unic" lista se golește: o categorie păstrată pe ascuns ar
      // reapărea la următoarea comutare, cu sume pe care nimeni nu le-a revăzut.
      await salveazaPreturilePeVarsta(
        campId,
        v.pricing_mode,
        v.pricing_mode === 'by_age'
          ? v.varste.map((c) => ({
              age_from: Number(c.age_from),
              age_to: Number(c.age_to),
              amount: ronToBani(Number(c.amount_lei)),
            }))
          : [],
      )

      qc.invalidateQueries({ queryKey: ['taberele-mele'] })
      qc.invalidateQueries({ queryKey: ['tabara-de-editat', campId] })
      qc.invalidateQueries({ queryKey: ['categoriile-taberei', campId] })
      qc.invalidateQueries({ queryKey: ['preturile-pe-varsta', campId] })
      toast.success(eEditare ? 'Tabără actualizată.' : 'Tabără creată.')
      navigate(baza)
    } catch (e) {
      // Mesajul bazei e scris pentru om („Suma categoriilor (X) nu da pretul
      // taberei (Y)"), deci se arată, nu se înlocuiește cu un „a eșuat" generic.
      const mesaj = e instanceof Error ? e.message : ''
      toast.error(mesaj || 'Nu am putut salva tabăra.')
    }
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

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
        <Camp eticheta="Titlu" eroare={errors.title?.message}>
          <Input
            {...titluReg}
            className="h-11 lg:h-9"
            aria-invalid={!!errors.title}
            onBlur={(e) => {
              // `register` își aduce propriul onBlur, care marchează câmpul ca
              // atins. Spread-ul îl pune primul, al nostru l-ar fi înlocuit —
              // deci se cheamă explicit, altfel validarea la ieșirea din câmp
              // tace pe tot formularul.
              titluReg.onBlur(e)
              // Slugul se completează singur din titlu, dar numai cât timp e gol
              // și numai la creare: schimbarea lui pe o tabără publicată ar rupe
              // linkurile trimise deja părinților.
              if (!eEditare && !slugViu) setValue('slug', slugDinTitlu(e.target.value))
            }}
          />
        </Camp>

        <Camp
          eticheta="Adresa paginii"
          eroare={errors.slug?.message}
          ajutor={`/tabere/${slugViu || '...'}`}
        >
          <Input {...register('slug')} className="h-11 lg:h-9" aria-invalid={!!errors.slug} />
        </Camp>

        <div className="grid gap-5 sm:grid-cols-2">
          <Camp eticheta="Începe" eroare={errors.period_start?.message}>
            <Input type="date" {...register('period_start')} className="h-11 lg:h-9" />
          </Camp>
          <Camp eticheta="Se termină" eroare={errors.period_end?.message}>
            <Input type="date" {...register('period_end')} className="h-11 lg:h-9" />
          </Camp>
        </div>

        <Camp eticheta="Loc" ajutor="Unde are loc tabăra. Se vede pe pagina publică.">
          <Input {...register('location_text')} className="h-11 lg:h-9" />
        </Camp>

        <Camp eticheta="Locuri" ajutor="Lasă gol pentru tabără fără limită.">
          <Input type="number" min={0} {...register('capacity')} className="h-11 lg:h-9" />
        </Camp>

        <Camp eticheta="Descriere">
          <textarea
            {...register('description')}
            rows={4}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent p-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] [field-sizing:content] max-h-64"
          />
        </Camp>

        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" {...register('allow_cash')} className="size-4" />
          Acceptă plata cash
        </label>

        <fieldset className="rounded-2xl border p-5">
          <legend className="px-2 font-semibold">Ce include prețul</legend>

          <Camp eticheta="Prețul taberei" eroare={errors.price_lei?.message}>
            <Input
              type="number"
              step="0.01"
              min={0}
              {...register('price_lei')}
              className="h-11 lg:h-9"
              aria-invalid={!!errors.price_lei}
            />
          </Camp>

          <p className="text-muted-foreground mt-4 text-sm">
            Categoriile explică prețul, nu îl schimbă: părintele plătește totalul. Poți sări peste
            ele, dar dacă le pui, suma lor trebuie să dea exact prețul.
          </p>

          <ul className="mt-4 space-y-4">
            {fields.map((f, i) => (
              <li key={f.id} className="rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_140px]">
                    <Camp eticheta="Nume" eroare={errors.categorii?.[i]?.name?.message}>
                      <Input
                        {...register(`categorii.${i}.name`)}
                        className="h-11 lg:h-9"
                        placeholder="Cazare și masă"
                      />
                    </Camp>
                    <Camp eticheta="Sumă (lei)" eroare={errors.categorii?.[i]?.amount_lei?.message}>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`categorii.${i}.amount_lei`)}
                        className="h-11 lg:h-9"
                      />
                    </Camp>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-11 min-h-11 shrink-0"
                    onClick={() => remove(i)}
                    aria-label={`Șterge categoria ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Camp eticheta="Descriere">
                  <Input
                    {...register(`categorii.${i}.description`)}
                    className="h-11 lg:h-9"
                    placeholder="Pensiune la 15 minute de trasee, mic dejun inclus."
                  />
                </Camp>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            className="mt-4 h-11 min-h-11"
            onClick={() => append({ name: '', amount_lei: '', description: '' })}
          >
            <Plus className="size-4" /> Adaugă o categorie
          </Button>

          {areCategorii && (
            <p
              className={`mt-4 text-sm font-medium ${seDiferenta === 0 ? 'text-muted-foreground' : 'text-destructive'}`}
              role={seDiferenta === 0 ? undefined : 'alert'}
            >
              {seDiferenta === 0
                ? `Categoriile adună ${formatRon(sumaBani)} — exact prețul taberei.`
                : seDiferenta > 0
                  ? `Categoriile adună ${formatRon(sumaBani)}, cu ${formatRon(seDiferenta)} mai mult decât prețul.`
                  : `Categoriile adună ${formatRon(sumaBani)}, cu ${formatRon(-seDiferenta)} mai puțin decât prețul.`}
            </p>
          )}
          {errors.categorii?.root?.message && (
            <p className="text-destructive mt-2 text-sm" role="alert">
              {errors.categorii.root.message}
            </p>
          )}
        </fieldset>

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
                înscrie. Prețul unic de mai sus rămâne, deocamdată, cel afișat și cel plătit — pagina
                publică și înscrierea încep să citească categoriile la pasul următor.
              </p>

              <ul className="mt-4 space-y-4" aria-label="Categorii de vârstă">
                {varsteArr.fields.map((f, i) => (
                  <li key={f.id} className="rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-3">
                        <Camp eticheta="De la (ani)" eroare={errors.varste?.[i]?.age_from?.message}>
                          <Input
                            type="number"
                            min={0}
                            max={25}
                            {...register(`varste.${i}.age_from`)}
                            className="h-11 lg:h-9"
                            aria-invalid={!!errors.varste?.[i]?.age_from}
                          />
                        </Camp>
                        <Camp eticheta="Până la (ani)" eroare={errors.varste?.[i]?.age_to?.message}>
                          <Input
                            type="number"
                            min={0}
                            max={25}
                            {...register(`varste.${i}.age_to`)}
                            className="h-11 lg:h-9"
                            aria-invalid={!!errors.varste?.[i]?.age_to}
                          />
                        </Camp>
                        <Camp eticheta="Sumă (lei)" eroare={errors.varste?.[i]?.amount_lei?.message}>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            {...register(`varste.${i}.amount_lei`)}
                            className="h-11 lg:h-9"
                            aria-invalid={!!errors.varste?.[i]?.amount_lei}
                          />
                        </Camp>
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
                  </li>
                ))}
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

        {eEditare && tabara ? (
          <>
            <CampPhotosSection campId={tabara.id} heroCale={tabara.hero_photo_storage_path} />
            <CampCoachesSection campId={tabara.id} />
          </>
        ) : (
          !eEditare && (
            <p className="text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
              Pozele și antrenorii se adaugă după ce salvezi tabăra: și unele, și alții au nevoie
              de o tabără care există deja.
            </p>
          )
        )}

        <Button type="submit" className="h-11 min-h-11 px-6" disabled={isSubmitting || !gata}>
          {eEditare ? 'Salvează' : 'Creează tabăra'}
        </Button>
      </form>
    </div>
  )
}

function Camp({
  eticheta,
  ajutor,
  eroare,
  children,
}: {
  eticheta: string
  ajutor?: string
  eroare?: string
  children: React.ReactNode
}) {
  // Eticheta se leagă de câmp prin id, ca un cititor de ecran să știe ce
  // completează; până acum textul stătea doar lângă câmp.
  const id = useId()
  const camp = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id })
    : children
  return (
    <div className="mt-3 first:mt-0">
      <Label htmlFor={id} className="mb-1.5 block">
        {eticheta}
      </Label>
      {camp}
      {ajutor && !eroare && <p className="text-muted-foreground mt-1 text-xs">{ajutor}</p>}
      {eroare && (
        <p className="text-destructive mt-1 text-xs" role="alert">
          {eroare}
        </p>
      )}
    </div>
  )
}
