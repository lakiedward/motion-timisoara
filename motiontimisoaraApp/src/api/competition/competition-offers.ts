import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  maxCompetitionGpxBytes,
  parseCompetitionGpx,
} from '@/features/competitions/competition-gpx'
import { listCompetitionRoutePhotos } from './competition-route-photos'

export type CompetitionRoute = {
  id: string
  competition_id: string
  name: string
  description: string
  gpx_storage_path: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type CompetitionAgeCategory = {
  id: string
  competition_id: string
  route_id: string
  name: string
  age_from: number
  age_to: number
  price_bani: number
  display_order: number
  created_at: string
  updated_at: string
}

export type CompetitionCategory = CompetitionAgeCategory

export type CompetitionOffers = {
  routes: CompetitionRoute[]
  categories: CompetitionAgeCategory[]
}

export type CompetitionRouteInput = Pick<CompetitionRoute, 'name' | 'description'>
export type CompetitionCategoryInput = Pick<
  CompetitionAgeCategory,
  'name' | 'route_id' | 'age_from' | 'age_to' | 'price_bani'
>

type LocalTable<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type OffersDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      competition_routes: LocalTable<
        CompetitionRoute,
        Pick<
          CompetitionRoute,
          'id' | 'competition_id' | 'name' | 'description' | 'display_order'
        > & {
          gpx_storage_path?: string | null
        },
        Partial<
          Pick<CompetitionRoute, 'name' | 'description' | 'gpx_storage_path' | 'display_order'>
        >
      >
      competition_age_categories: LocalTable<
        CompetitionAgeCategory,
        Pick<
          CompetitionAgeCategory,
          | 'id'
          | 'competition_id'
          | 'route_id'
          | 'name'
          | 'age_from'
          | 'age_to'
          | 'price_bani'
          | 'display_order'
        >,
        Partial<
          Pick<
            CompetitionAgeCategory,
            'route_id' | 'name' | 'age_from' | 'age_to' | 'price_bani' | 'display_order'
          >
        >
      >
    }
  }
}

const offersDb = supabase as SupabaseClient<OffersDatabase>
const routeBucket = 'competition-routes'

export function competitionOfferErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    /^(Intervalul|Șterge sau mută|Numele|Descrierea|Alege|Scrie|Prețul|Fișierul|Traseul)/.test(
      error.message,
    )
  ) {
    return error.message
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === '23P01') {
    return 'Intervalul de vârstă se suprapune cu altă categorie.'
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
    return 'Înregistrarea este folosită în altă parte și nu poate fi ștearsă.'
  }
  return 'Nu am putut finaliza acțiunea. Reîncearcă.'
}

function validateRoute(input: CompetitionRouteInput): CompetitionRouteInput {
  const name = input.name.trim()
  const description = input.description.trim()
  if (!name || name.length > 120)
    throw new Error('Numele traseului trebuie să aibă 1–120 caractere.')
  if (!description || description.length > 4000) {
    throw new Error('Descrierea traseului trebuie să aibă 1–4.000 caractere.')
  }
  return { name, description }
}

export function validateCompetitionCategory(
  input: CompetitionCategoryInput,
  offers: CompetitionOffers,
  editingId?: string,
): CompetitionCategoryInput {
  const name = input.name.trim()
  if (!name || name.length > 120)
    throw new Error('Numele categoriei trebuie să aibă 1–120 caractere.')
  if (!offers.routes.some((route) => route.id === input.route_id && route.gpx_storage_path)) {
    throw new Error('Alege un traseu cu fișier GPX salvat pentru categorie.')
  }
  if (
    !Number.isInteger(input.age_from) ||
    !Number.isInteger(input.age_to) ||
    input.age_from < 0 ||
    input.age_to > 120 ||
    input.age_from > input.age_to
  ) {
    throw new Error('Intervalul de vârstă trebuie să fie între 0 și 120 ani.')
  }
  if (
    !Number.isSafeInteger(input.price_bani) ||
    input.price_bani < 0 ||
    input.price_bani > 99_999_999
  ) {
    throw new Error('Prețul categoriei trebuie să fie între 0 și 999.999,99 lei.')
  }
  if (
    offers.categories.some(
      (category) =>
        category.id !== editingId &&
        input.age_from <= category.age_to &&
        category.age_from <= input.age_to,
    )
  ) {
    throw new Error('Intervalul de vârstă se suprapune cu altă categorie.')
  }
  return { ...input, name }
}

export function competitionRouteGpxUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from(routeBucket).getPublicUrl(path).data.publicUrl
}

export function competitionRouteGpxDownloadUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from(routeBucket).getPublicUrl(path, { download: true }).data.publicUrl
}

export async function listCompetitionOffers(competitionId: string): Promise<CompetitionOffers> {
  const [routes, categories] = await Promise.all([
    getCompetitionRoutes(competitionId),
    getCompetitionCategories(competitionId),
  ])
  return { routes, categories }
}

export async function getCompetitionRoutes(competitionId: string): Promise<CompetitionRoute[]> {
  const { data, error } = await offersDb
    .from('competition_routes')
    .select('*')
    .eq('competition_id', competitionId)
    .order('display_order')
    .order('id')
  if (error) throw error
  return data ?? []
}

export async function getCompetitionCategories(
  competitionId: string,
): Promise<CompetitionCategory[]> {
  const { data, error } = await offersDb
    .from('competition_age_categories')
    .select('*')
    .eq('competition_id', competitionId)
    .order('display_order')
    .order('id')
  if (error) throw error
  return data ?? []
}

async function readGpxFile(file: File): Promise<Blob> {
  if (!/\.gpx$/i.test(file.name)) throw new Error('Alege un fișier cu extensia .gpx.')
  if (file.size > maxCompetitionGpxBytes) throw new Error('Fișierul GPX depășește limita de 2 MB.')
  const xml = await file.text()
  parseCompetitionGpx(xml)
  return new Blob([xml], { type: 'application/gpx+xml' })
}

async function uploadRouteGpx(competitionId: string, routeId: string, file: File): Promise<string> {
  const content = await readGpxFile(file)
  const path = `${competitionId}/routes/${routeId}/${crypto.randomUUID()}.gpx`
  const { error } = await supabase.storage.from(routeBucket).upload(path, content, {
    contentType: 'application/gpx+xml',
    upsert: false,
  })
  if (error) throw error
  return path
}

async function removeRouteGpx(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(routeBucket).remove([path])
  return Boolean(error)
}

export async function createCompetitionRoute(
  competitionId: string,
  input: CompetitionRouteInput,
  file: File,
): Promise<CompetitionRoute> {
  const values = validateRoute(input)
  if (!file) throw new Error('Fișierul GPX este obligatoriu pentru un traseu nou.')
  await readGpxFile(file)
  const routeId = crypto.randomUUID()
  const { error } = await offersDb
    .from('competition_routes')
    .insert({ id: routeId, competition_id: competitionId, ...values, display_order: 0 })
    .select()
    .single()
  if (error) throw error
  try {
    const path = await uploadRouteGpx(competitionId, routeId, file)
    const result = await offersDb
      .from('competition_routes')
      .update({ gpx_storage_path: path })
      .eq('competition_id', competitionId)
      .eq('id', routeId)
      .select()
      .single()
    if (result.error) {
      await removeRouteGpx(path)
      throw result.error
    }
    return result.data
  } catch (uploadError) {
    await offersDb
      .from('competition_routes')
      .delete()
      .eq('competition_id', competitionId)
      .eq('id', routeId)
    throw uploadError
  }
}

export async function updateCompetitionRoute(
  competitionId: string,
  routeId: string,
  input: CompetitionRouteInput,
  file: File | null,
): Promise<{ route: CompetitionRoute; cleanupFailed: boolean }> {
  const values = validateRoute(input)
  const currentResult = await offersDb
    .from('competition_routes')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('id', routeId)
    .single()
  if (currentResult.error) throw currentResult.error

  const oldPath = currentResult.data.gpx_storage_path
  if (!oldPath && !file) throw new Error('Fișierul GPX este obligatoriu pentru traseu.')
  const newPath = file ? await uploadRouteGpx(competitionId, routeId, file) : null
  const nextPath = newPath ?? oldPath
  const result = await offersDb
    .from('competition_routes')
    .update({ ...values, gpx_storage_path: nextPath })
    .eq('competition_id', competitionId)
    .eq('id', routeId)
    .select()
    .single()
  if (result.error) {
    if (newPath) await removeRouteGpx(newPath)
    throw result.error
  }

  const cleanupFailed = oldPath && oldPath !== nextPath ? await removeRouteGpx(oldPath) : false
  return { route: result.data, cleanupFailed }
}

export async function deleteCompetitionRoute(
  competitionId: string,
  routeId: string,
): Promise<{ cleanupFailed: boolean }> {
  const categories = await offersDb
    .from('competition_age_categories')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('route_id', routeId)
    .limit(1)
  if (categories.error) throw categories.error
  if (categories.data.length > 0) {
    throw new Error('Șterge sau mută mai întâi categoriile care folosesc acest traseu.')
  }

  const photos = (await listCompetitionRoutePhotos(competitionId))
    .filter((photo) => photo.route_id === routeId)
    .map((photo) => photo.storage_path)

  const result = await offersDb
    .from('competition_routes')
    .delete()
    .eq('competition_id', competitionId)
    .eq('id', routeId)
    .select()
    .single()
  if (result.error) throw result.error
  let cleanupFailed = false
  if (result.data.gpx_storage_path) {
    try {
      cleanupFailed = await removeRouteGpx(result.data.gpx_storage_path)
    } catch {
      cleanupFailed = true
    }
  }
  if (photos.length > 0) {
    try {
      const removed = await supabase.storage.from('competition-photos').remove(photos)
      cleanupFailed = cleanupFailed || Boolean(removed.error)
    } catch {
      cleanupFailed = true
    }
  }
  return {
    cleanupFailed,
  }
}

export async function createCompetitionCategory(
  competitionId: string,
  input: CompetitionCategoryInput,
): Promise<CompetitionAgeCategory> {
  const offers = await listCompetitionOffers(competitionId)
  const values = validateCompetitionCategory(input, offers)
  const { data, error } = await offersDb
    .from('competition_age_categories')
    .insert({ id: crypto.randomUUID(), competition_id: competitionId, ...values, display_order: 0 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCompetitionCategory(
  competitionId: string,
  categoryId: string,
  input: CompetitionCategoryInput,
): Promise<CompetitionAgeCategory> {
  const offers = await listCompetitionOffers(competitionId)
  const values = validateCompetitionCategory(input, offers, categoryId)
  const { data, error } = await offersDb
    .from('competition_age_categories')
    .update(values)
    .eq('competition_id', competitionId)
    .eq('id', categoryId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCompetitionCategory(
  competitionId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await offersDb
    .from('competition_age_categories')
    .delete()
    .eq('competition_id', competitionId)
    .eq('id', categoryId)
    .select()
    .single()
  if (error) throw error
}
