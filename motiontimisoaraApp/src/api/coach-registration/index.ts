import { supabase } from '@/lib/supabase'

export interface CoachInvitationInput {
  invitationCode: string
  name: string
  phone?: string
  bio?: string
  sportIds?: string[]
}

type CoachInvitationResult =
  | { coachProfileId: string; alreadyCoach: boolean; error?: never }
  | { error: { message: string } }

const REDEEM_ERROR = 'Nu am putut activa contul de antrenor. Încearcă din nou.'

const COACH_INVITATION_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: 'Verifică datele pentru contul de antrenor.',
  INVALID_INVITATION: 'Cod de invitație invalid.',
  INVITATION_EXPIRED: 'Codul de invitație a expirat. Cere unul nou clubului.',
  INVITATION_EXHAUSTED: 'Codul de invitație a fost deja folosit de numărul maxim de ori.',
  INVALID_SPORTS: 'Selecția sporturilor nu mai este disponibilă. Alege din nou.',
  EMAIL_UNVERIFIED: 'Confirmă adresa de email înainte de a activa contul de antrenor.',
  PROFILE_DISABLED: 'Contul este dezactivat. Contactează administratorul.',
  ROLE_NOT_ELIGIBLE: 'Acest cont nu poate fi transformat în cont de antrenor.',
  PROFILE_NOT_FOUND: 'Profilul contului nu este disponibil. Contactează administratorul.',
  PROFILE_CONFLICT: 'Profilul contului trebuie verificat de administrator.',
  UNAUTHORIZED: 'Sesiunea a expirat. Autentifică-te din nou.',
  ACCOUNT_EXISTS: 'Există deja un cont cu acest email. Autentifică-te pentru a folosi invitația.',
  SERVER_ERROR: 'Nu am putut finaliza contul de antrenor. Încearcă din nou.',
}

export function coachInvitationErrorMessage(code: unknown, raw?: string): string | undefined {
  if (typeof code === 'string' && Object.hasOwn(COACH_INVITATION_MESSAGES, code))
    return COACH_INVITATION_MESSAGES[code]
  return Object.values(COACH_INVITATION_MESSAGES).find((message) => message === raw)
}

export async function redeemCoachInvitation(
  input: CoachInvitationInput,
): Promise<CoachInvitationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('redeem-coach-invitation', {
      body: {
        invitationCode: input.invitationCode,
        name: input.name,
        phone: input.phone,
        bio: input.bio,
        sportIds: input.sportIds,
      },
    })
    if (error) {
      const context = (error as { context?: Response }).context
      const body = await context?.json().catch(() => null)
      return {
        error: { message: coachInvitationErrorMessage(body?.code, body?.error) ?? REDEEM_ERROR },
      }
    }
    if (typeof data?.error === 'string')
      return {
        error: { message: coachInvitationErrorMessage(data.code, data.error) ?? REDEEM_ERROR },
      }
    if (typeof data?.coachProfileId !== 'string' || typeof data?.alreadyCoach !== 'boolean')
      return { error: { message: REDEEM_ERROR } }
    return { coachProfileId: data.coachProfileId, alreadyCoach: data.alreadyCoach }
  } catch {
    return { error: { message: REDEEM_ERROR } }
  }
}
