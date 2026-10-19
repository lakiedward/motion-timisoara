import { supabase } from '@/lib/supabase'
import { activityHeroUrl, courseHeroUrl, publicUrl } from '@/api/public'

export type OfferKind = 'CAMP' | 'COURSE' | 'ACTIVITY' | 'COMPETITION'

export type OfferSchedule =
  | { type: 'session'; startsAt: string }
  | { type: 'period'; start: string; end: string }
  | { type: 'day'; date: string; startTime: string | null; endTime: string | null }
  | { type: 'moment'; startsAt: string }

export type EnrollmentOffer = {
  title: string
  path: string
  imageUrl: string | null
  sportCode: string | null
  sportName: string | null
  schedule: OfferSchedule | null
}

type Sport = { code: string; name: string; default_photo_storage_path: string | null } | null

const SPORT = 'sport:sports(code,name,default_photo_storage_path)'

async function nextSessions(courseIds: string[], now: Date) {
  const next = new Map<string, string>()
  if (!courseIds.length) return next
  const { data, error } = await supabase
    .from('course_occurrences')
    .select('course_id, starts_at')
    .in('course_id', courseIds)
    .gte('starts_at', now.toISOString())
    .order('starts_at', { ascending: true })
  if (error) throw error
  for (const row of data ?? []) if (!next.has(row.course_id)) next.set(row.course_id, row.starts_at)
  return next
}

async function offersById(
  kind: OfferKind,
  ids: string[],
  now: Date,
): Promise<Map<string, EnrollmentOffer>> {
  const offers = new Map<string, EnrollmentOffer>()
  if (!ids.length) return offers
  if (kind === 'COMPETITION') {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title, slug, hero_photo_storage_path, start_at')
      .in('id', ids)
    if (error) throw error
    for (const row of data ?? [])
      offers.set(row.id, {
        title: row.title.trim(),
        path: `/concursuri/${row.slug}`,
        imageUrl: publicUrl('competition-photos', row.hero_photo_storage_path),
        sportCode: null,
        sportName: null,
        schedule: row.start_at ? { type: 'moment', startsAt: row.start_at } : null,
      })
  } else if (kind === 'CAMP') {
    const { data, error } = await supabase
      .from('camps')
      .select('id, title, slug, hero_photo_storage_path, period_start, period_end')
      .in('id', ids)
    if (error) throw error
    for (const row of data ?? [])
      offers.set(row.id, {
        title: row.title.trim(),
        path: `/tabere/${row.slug}`,
        imageUrl: publicUrl('camp-photos', row.hero_photo_storage_path),
        sportCode: null,
        sportName: null,
        schedule:
          row.period_start && row.period_end
            ? { type: 'period', start: row.period_start, end: row.period_end }
            : null,
      })
  } else if (kind === 'COURSE') {
    const [{ data, error }, next] = await Promise.all([
      supabase
        .from('courses')
        .select(`id, name, hero_photo_storage_path, course_photos(storage_path,display_order), ${SPORT}`)
        .in('id', ids),
      nextSessions(ids, now),
    ])
    if (error) throw error
    for (const row of data ?? []) {
      const sport = row.sport as Sport
      const startsAt = next.get(row.id)
      offers.set(row.id, {
        title: row.name.trim(),
        path: `/cursuri/${row.id}`,
        imageUrl: courseHeroUrl({ ...row, sport }),
        sportCode: sport?.code ?? null,
        sportName: sport?.name ?? null,
        schedule: startsAt ? { type: 'session', startsAt } : null,
      })
    }
  } else {
    const { data, error } = await supabase
      .from('activities')
      .select(`id, name, hero_photo_storage_path, activity_date, start_time, end_time, ${SPORT}`)
      .in('id', ids)
    if (error) throw error
    for (const row of data ?? []) {
      const sport = row.sport as Sport
      offers.set(row.id, {
        title: row.name.trim(),
        path: `/activitati/${row.id}`,
        imageUrl: activityHeroUrl({ ...row, sport }),
        sportCode: sport?.code ?? null,
        sportName: sport?.name ?? null,
        schedule: row.activity_date
          ? {
              type: 'day',
              date: row.activity_date,
              startTime: row.start_time,
              endTime: row.end_time,
            }
          : null,
      })
    }
  }
  return offers
}

export async function enrollmentOffers(
  rows: { kind: string; entity_id: string }[],
  now = new Date(),
): Promise<Map<string, EnrollmentOffer>> {
  const kinds: OfferKind[] = ['CAMP', 'COURSE', 'ACTIVITY', 'COMPETITION']
  const maps = await Promise.all(
    kinds.map((kind) =>
      offersById(kind, [
        ...new Set(rows.filter((row) => row.kind === kind).map((row) => row.entity_id)),
      ], now),
    ),
  )
  return new Map(
    maps.flatMap((map, index) => [...map].map(([id, offer]) => [`${kinds[index]}:${id}`, offer] as const)),
  )
}
