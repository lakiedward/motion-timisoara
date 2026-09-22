import { campRulesForSave } from '@/lib/camp-rules'
import { readCampRequirements, campRequirementsForSave } from '@/lib/camp-requirements'
import type { SablonDeSalvat, SablonTabara } from '@/api/camps-admin'
import { CATEGORIE_GOALA, COMPONENTA_GOALA, GOL, num, schema, spreCamp, type Values } from '../camp-form-schema'
import { preturiPeVarstaDinDraft } from '../camp-form-totals'

const IGNORA_LA_SABLON = new Set([
  'title',
  'slug',
  'period_start',
  'period_end',
  'eur_ron_rate',
  'adult',
])

export function pasCuEroareSablon(values: Values): 0 | 1 | null {
  const parsed = schema.safeParse(values)
  if (parsed.success) return null
  const relevante = parsed.error.issues.filter((issue) => !IGNORA_LA_SABLON.has(String(issue.path[0])))
  if (relevante.length === 0) return null
  if (relevante.some((issue) => issue.path[0] === 'varste' || issue.path[0] === 'currency')) return 1
  return 0
}

export function payloadSablon(name: string, values: Values): SablonDeSalvat | null {
  const nume = name.trim()
  if (nume.length < 1 || nume.length > 120) return null
  if (pasCuEroareSablon(values) !== null) return null
  return {
    name: nume,
    description: values.description?.trim() ? values.description.trim() : null,
    rules: campRulesForSave(values.rules),
    location_id: values.location_id || null,
    location_text: values.location_text?.trim() ? values.location_text.trim() : null,
    capacity: num(values.capacity),
    allow_cash: values.allow_cash,
    currency: values.currency,
    camp_requirements: campRequirementsForSave(values.necesar),
    age_prices: preturiPeVarstaDinDraft(values.varste).map(({ age_from, age_to, components }) => ({
      age_from,
      age_to,
      components,
    })),
  }
}

function categorieGoala(): Values['varste'][number] {
  return { ...CATEGORIE_GOALA, componente: [{ ...COMPONENTA_GOALA }] }
}

function aceleasiVarste(a: Values['varste'], b: Values['varste']) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function formularAreDate(values: Values): boolean {
  return (
    values.title.trim() !== '' ||
    values.slug.trim() !== '' ||
    values.period_start !== '' ||
    values.period_end !== '' ||
    values.eur_ron_rate.trim() !== '' ||
    values.currency !== GOL.currency ||
    (values.description ?? '') !== (GOL.description ?? '') ||
    values.rules.trim() !== '' ||
    values.necesar.length > 0 ||
    values.allow_cash !== GOL.allow_cash ||
    (values.location_id ?? '') !== '' ||
    (values.location_text ?? '') !== '' ||
    (values.capacity ?? '') !== '' ||
    !aceleasiVarste(values.varste, [categorieGoala()])
  )
}

export function aplicaSablon(values: Values, sablon: SablonTabara): Values {
  const requirements = readCampRequirements(sablon.camp_requirements)
  return {
    ...values,
    currency: sablon.currency,
    eur_ron_rate: values.currency === sablon.currency ? values.eur_ron_rate : '',
    description: sablon.description ?? '',
    rules: sablon.rules ?? '',
    location_id: sablon.location_id ?? '',
    location_text: sablon.location_text ?? '',
    capacity: sablon.capacity?.toString() ?? '',
    allow_cash: sablon.allow_cash,
    necesar: requirements.map((categorie) => ({
      name: categorie.name,
      items: categorie.items.map((articol) => ({
        name: articol.name,
        quantity: String(articol.quantity),
      })),
    })),
    varste: sablon.age_prices.map((categorie) =>
      spreCamp({
        age_from: categorie.age_from,
        age_to: categorie.age_to,
        amount: 0,
        components: categorie.components,
      }),
    ),
  }
}

export function golesteCampuriCopiate(values: Values): Values {
  return {
    ...values,
    currency: GOL.currency,
    eur_ron_rate: '',
    description: GOL.description,
    rules: GOL.rules,
    location_id: '',
    location_text: '',
    capacity: '',
    allow_cash: GOL.allow_cash,
    necesar: [],
    varste: [categorieGoala()],
  }
}
