import type { SupabaseClient } from '@supabase/supabase-js'
import { esteImagine, micsoreazaPoza } from '@/lib/media'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

const bucket = 'competition-photos'

export const MAX_COMPETITION_ROUTE_PHOTOS = 12

type CompetitionRoutePhotoRow = {
  id: string
  competition_id: string
  route_id: string
  storage_path: string
  display_order: number
  created_at: string
}

export type CompetitionRoutePhoto = CompetitionRoutePhotoRow & { url: string }

type RoutePhotosDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      competition_route_photos: {
        Row: CompetitionRoutePhotoRow
        Insert: Pick<
          CompetitionRoutePhotoRow,
          'competition_id' | 'route_id' | 'storage_path' | 'display_order'
        > & { id?: string }
        Update: Partial<Pick<CompetitionRoutePhotoRow, 'display_order'>>
        Relationships: []
      }
    }
  }
}

const routePhotosDb = supabase as SupabaseClient<RoutePhotosDatabase>

export function competitionRoutePhotoUrl(path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function listCompetitionRoutePhotos(
  competitionId: string,
): Promise<CompetitionRoutePhoto[]> {
  const { data, error } = await routePhotosDb
    .from('competition_route_photos')
    .select('*')
    .eq('competition_id', competitionId)
    .order('route_id')
    .order('display_order')
    .order('id')
  if (error) throw error
  return (data ?? []).map((photo) => ({
    ...photo,
    url: competitionRoutePhotoUrl(photo.storage_path),
  }))
}

type SupportedImage = { extension: 'jpg' | 'png' | 'webp'; contentType: string }

async function supportedImage(content: Blob): Promise<SupportedImage | null> {
  const bytes = new Uint8Array(await content.slice(0, 12).arrayBuffer())
  if (
    content.type === 'image/jpeg' &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extension: 'jpg', contentType: 'image/jpeg' }
  }
  if (
    content.type === 'image/png' &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' }
  }
  if (
    content.type === 'image/webp' &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { extension: 'webp', contentType: 'image/webp' }
  }
  return null
}

export async function addCompetitionRoutePhotos(
  competitionId: string,
  routeId: string,
  files: File[],
  existingCount: number,
): Promise<{ added: number; rejected: string[] }> {
  const rejected: string[] = []
  const available = Math.max(0, MAX_COMPETITION_ROUTE_PHOTOS - existingCount)
  let added = 0
  let nextOrder: number | null = null
  for (const file of files) {
    if (!esteImagine(file)) {
      rejected.push(`${file.name}: nu este o imagine.`)
      continue
    }
    if (added >= available) {
      rejected.push(
        `${file.name}: galeria poate avea cel mult ${MAX_COMPETITION_ROUTE_PHOTOS} poze.`,
      )
      continue
    }

    let uploadedPath: string | null = null
    try {
      const content = await micsoreazaPoza(file)
      const image = await supportedImage(content)
      if (!image) {
        rejected.push(`${file.name}: formatul imaginii nu este compatibil.`)
        continue
      }
      if (nextOrder === null) {
        const latest = await routePhotosDb
          .from('competition_route_photos')
          .select('display_order')
          .eq('competition_id', competitionId)
          .eq('route_id', routeId)
          .order('display_order', { ascending: false })
          .limit(1)
        if (latest.error) throw latest.error
        nextOrder = (latest.data?.[0]?.display_order ?? -1) + 1
      }
      const path = `${competitionId}/routes/${routeId}/gallery/${crypto.randomUUID()}.${image.extension}`
      const upload = await supabase.storage.from(bucket).upload(path, content, {
        contentType: image.contentType,
        upsert: false,
      })
      if (upload.error) throw upload.error
      uploadedPath = path

      const { error } = await routePhotosDb
        .from('competition_route_photos')
        .insert({
          competition_id: competitionId,
          route_id: routeId,
          storage_path: path,
          display_order: nextOrder,
        })
        .select()
        .single()
      if (error) throw error
      added += 1
      nextOrder += 1
    } catch {
      let cleanupFailed = false
      if (uploadedPath) {
        try {
          const removed = await supabase.storage.from(bucket).remove([uploadedPath])
          cleanupFailed = Boolean(removed.error)
        } catch {
          cleanupFailed = true
        }
      }
      rejected.push(
        cleanupFailed
          ? `${file.name}: nu a putut fi adăugată, iar fișierul încărcat nu a putut fi șters.`
          : `${file.name}: nu a putut fi adăugată în galerie.`,
      )
    }
  }
  return { added, rejected }
}

export async function deleteCompetitionRoutePhoto(
  photo: CompetitionRoutePhoto,
): Promise<{ cleanupFailed: boolean }> {
  const { data, error } = await routePhotosDb
    .from('competition_route_photos')
    .delete()
    .eq('id', photo.id)
    .eq('competition_id', photo.competition_id)
    .eq('route_id', photo.route_id)
    .select('storage_path')
    .single()
  if (error) throw error
  try {
    const removed = await supabase.storage.from(bucket).remove([data.storage_path])
    return { cleanupFailed: Boolean(removed.error) }
  } catch {
    return { cleanupFailed: true }
  }
}

export async function moveCompetitionRoutePhoto(
  photos: CompetitionRoutePhoto[],
  index: number,
  direction: -1 | 1,
): Promise<void> {
  const neighborIndex = index + direction
  if (index < 0 || neighborIndex < 0 || neighborIndex >= photos.length) return
  const current = photos[index]!
  const neighbor = photos[neighborIndex]!
  if (current.route_id !== neighbor.route_id) return

  const first = await routePhotosDb
    .from('competition_route_photos')
    .update({ display_order: neighbor.display_order })
    .eq('id', current.id)
    .eq('competition_id', current.competition_id)
    .eq('route_id', current.route_id)
    .select()
    .single()
  if (first.error) throw first.error

  const second = await routePhotosDb
    .from('competition_route_photos')
    .update({ display_order: current.display_order })
    .eq('id', neighbor.id)
    .eq('competition_id', neighbor.competition_id)
    .eq('route_id', neighbor.route_id)
    .select()
    .single()
  if (second.error) throw second.error
}
