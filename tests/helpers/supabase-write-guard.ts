import type { BrowserContext, Page } from '@playwright/test'

const SUPABASE_HOST = /^https:\/\/[a-z0-9]+\.supabase\.co\//i

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const READ_ONLY_RPCS = new Set([
  'activity_spots_remaining',
  'admin_clubs',
  'admin_stats',
  'admin_users',
  'camp_spots_remaining',
  'club_coach_contacts',
  'course_spots_remaining',
  'get_competition_cash_payments',
  'get_competition_podium_candidates',
  'get_my_children_camp_attendance',
  'get_my_coach_profile_id',
  'get_parent_announcement_courses',
  'get_parent_announcement_feed',
  'get_published_competition_podium',
  'my_club',
  'my_profile',
])

const PROBE_RPC = 'role_smoke_write_guard_probe'

export type WriteGuard = {
  blocked: string[]
  supabaseOrigin: () => string | null
  probe: (page: Page) => Promise<{ rejected: boolean; recorded: boolean }>
}

function describe(method: string, url: URL) {
  return `${method} ${url.pathname}`
}

function allowed(method: string, url: URL) {
  if (READ_METHODS.has(method)) return true
  if (method !== 'POST') return false
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') return true
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/i)?.[1]
  return !!rpc && READ_ONLY_RPCS.has(rpc)
}

export async function installSupabaseWriteGuard(context: BrowserContext): Promise<WriteGuard> {
  const blocked: string[] = []
  let origin: string | null = null

  await context.route(SUPABASE_HOST, (route) => {
    const request = route.request()
    const url = new URL(request.url())
    origin ??= url.origin
    if (allowed(request.method(), url)) return route.continue()
    blocked.push(describe(request.method(), url))
    return route.abort('blockedbyclient')
  })

  return {
    blocked,
    supabaseOrigin: () => origin,
    probe: async (page) => {
      if (!origin) throw new Error('Pagina nu a făcut nicio cerere spre Supabase; nu am pe ce verifica blocajul.')
      const target = `${origin}/rest/v1/rpc/${PROBE_RPC}`
      const before = blocked.length
      const rejected = await page.evaluate(async (url) => {
        try {
          await fetch(url, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
          return false
        } catch {
          return true
        }
      }, target)
      const recorded = blocked.slice(before).includes(`POST /rest/v1/rpc/${PROBE_RPC}`)
      return { rejected, recorded }
    },
  }
}
