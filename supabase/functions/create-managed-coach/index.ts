// Edge Function: create-managed-coach
// Lets a CLUB owner or ADMIN create a coach account directly (no invitation
// code). A CLUB-created coach is added to the caller's club roster; an ADMIN
// may optionally target a club via `clubId`. Returns a generated temp password
// the caller shares with the coach.
//
// verify_jwt is disabled at the platform level; this function authenticates the
// caller manually from the Authorization header and authorizes by profile role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Readable temp password, e.g. "Motion-7K2P9Q"
function tempPassword(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = Array.from(
    crypto.getRandomValues(new Uint8Array(7)),
    (n) => a[n % a.length]
  ).join('')
  return `Motion-${part}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // 1. Authenticate the caller from the bearer token.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Unauthorized' }, 401)
    const {
      data: { user: caller },
    } = await supabaseAdmin.auth.getUser(token)
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    // 2. Authorize: caller must be CLUB or ADMIN.
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    const role = callerProfile?.role
    if (role !== 'CLUB' && role !== 'ADMIN') {
      return json({ error: 'Forbidden' }, 403)
    }

    const body = await req.json()
    const { email, name, phone, bio, sportIds, clubId } = body as {
      email?: string
      name?: string
      phone?: string
      bio?: string
      sportIds?: string[]
      clubId?: string
    }
    if (!email || !name) return json({ error: 'email and name are required' }, 400)

    // 3. Resolve the target club (required for CLUB callers).
    let targetClubId: string | null = null
    if (role === 'CLUB') {
      const { data: club } = await supabaseAdmin
        .from('clubs')
        .select('id')
        .eq('owner_user_id', caller.id)
        .maybeSingle()
      if (!club) return json({ error: 'No club found for this owner' }, 400)
      targetClubId = club.id
    } else if (clubId) {
      targetClubId = clubId
    }

    // 4. Create the auth user (COACH role).
    const password = tempPassword()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, role: 'COACH' },
    })
    if (authError) return json({ error: authError.message }, 400)
    const userId = authData.user.id

    // 5. Create coach_profiles row (+ sports). handle_new_user already created
    //    the profiles row from user_metadata.
    const { data: coachProfile } = await supabaseAdmin
      .from('coach_profiles')
      .insert({ user_id: userId, bio: bio ?? null })
      .select('id')
      .single()

    if (sportIds?.length && coachProfile) {
      await supabaseAdmin
        .from('coach_sports')
        .insert(sportIds.map((sportId) => ({ coach_profile_id: coachProfile.id, sport_id: sportId })))
    }

    // 6. Add to the club roster if applicable.
    if (targetClubId && coachProfile) {
      await supabaseAdmin
        .from('club_coaches')
        .insert({ club_id: targetClubId, coach_profile_id: coachProfile.id })
    }

    return json({
      userId,
      email,
      tempPassword: password,
      clubId: targetClubId,
      message: 'Coach created successfully',
    })
  } catch (err) {
    console.error('create-managed-coach error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
