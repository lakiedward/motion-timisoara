const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const payloadKeys = ["invitationCode", "name", "phone", "bio", "sportIds"];

export type CoachInvitationRequest = {
  invitationCode: string;
  name: string;
  phone?: string;
  bio?: string;
  sportIds: string[];
};

export type CoachInvitationResult = {
  coachProfileId: string;
  alreadyCoach: boolean;
};

const failures = {
  INVALID_REQUEST: [400, "Verifică datele pentru contul de antrenor."],
  INVALID_INVITATION: [400, "Cod de invitație invalid."],
  INVITATION_EXPIRED: [
    409,
    "Codul de invitație a expirat. Cere unul nou clubului.",
  ],
  INVITATION_EXHAUSTED: [
    409,
    "Codul de invitație a fost deja folosit de numărul maxim de ori.",
  ],
  INVALID_SPORTS: [
    400,
    "Selecția sporturilor nu mai este disponibilă. Alege din nou.",
  ],
  EMAIL_UNVERIFIED: [
    403,
    "Confirmă adresa de email înainte de a activa contul de antrenor.",
  ],
  PROFILE_DISABLED: [
    403,
    "Contul este dezactivat. Contactează administratorul.",
  ],
  ROLE_NOT_ELIGIBLE: [
    403,
    "Acest cont nu poate fi transformat în cont de antrenor.",
  ],
  PROFILE_NOT_FOUND: [
    403,
    "Profilul contului nu este disponibil. Contactează administratorul.",
  ],
  PROFILE_CONFLICT: [
    409,
    "Profilul contului trebuie verificat de administrator.",
  ],
  IDENTITY_MISMATCH: [403, "Sesiunea nu corespunde contului autentificat."],
  UNAUTHORIZED: [401, "Sesiunea a expirat. Autentifică-te din nou."],
  ACCOUNT_EXISTS: [
    409,
    "Există deja un cont cu acest email. Autentifică-te pentru a folosi invitația.",
  ],
  SERVER_ERROR: [
    500,
    "Nu am putut finaliza contul de antrenor. Încearcă din nou.",
  ],
} as const;

export type CoachInvitationFailure = keyof typeof failures;

export function coachInvitationFailure(code: CoachInvitationFailure): Response {
  const [status, error] = failures[code];
  return Response.json({ code, error }, { status });
}

export function parseCoachInvitation(
  value: unknown,
  additionalKeys: string[] = [],
): CoachInvitationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) =>
      ![...payloadKeys, ...additionalKeys].includes(key)
    ) ||
    typeof input.invitationCode !== "string" ||
    input.invitationCode.trim().length < 1 ||
    input.invitationCode.trim().length > 200 ||
    typeof input.name !== "string" || input.name.trim().length < 2 ||
    input.name.trim().length > 200 ||
    (input.phone !== undefined &&
      (typeof input.phone !== "string" || input.phone.length > 50)) ||
    (input.bio !== undefined &&
      (typeof input.bio !== "string" || input.bio.length > 4000)) ||
    (input.sportIds !== undefined && (!Array.isArray(input.sportIds) ||
      input.sportIds.length > 50 || input.sportIds.some((id) =>
        typeof id !== "string" || !uuid.test(id)
      )))
  ) return null;
  return {
    invitationCode: input.invitationCode.trim(),
    name: input.name.trim(),
    phone: typeof input.phone === "string" ? input.phone.trim() : undefined,
    bio: typeof input.bio === "string" ? input.bio.trim() : undefined,
    sportIds: [...new Set((input.sportIds as string[] | undefined) ?? [])],
  };
}

export function coachInvitationParameters(
  userId: string,
  payload: CoachInvitationRequest,
) {
  return {
    p_user_id: userId,
    p_invitation_code: payload.invitationCode,
    p_name: payload.name,
    p_phone: payload.phone || null,
    p_bio: payload.bio || null,
    p_sport_ids: payload.sportIds,
  };
}

export function parseCoachInvitationResult(
  value: unknown,
): CoachInvitationResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  if (
    typeof result.coachProfileId !== "string" ||
    !uuid.test(result.coachProfileId) ||
    typeof result.alreadyCoach !== "boolean"
  ) return null;
  return {
    coachProfileId: result.coachProfileId,
    alreadyCoach: result.alreadyCoach,
  };
}

export function coachInvitationDatabaseFailure(
  error: { code?: string; message?: string },
): CoachInvitationFailure {
  if (error.message && Object.hasOwn(failures, error.message)) {
    return error.message as CoachInvitationFailure;
  }
  return error.code === "23503" ? "INVALID_SPORTS" : "SERVER_ERROR";
}

export function invitationAvailability(
  code: {
    expires_at: string | null;
    current_uses: number;
    max_uses: number;
  } | null,
  now = Date.now(),
): CoachInvitationFailure | null {
  if (!code) return "INVALID_INVITATION";
  if (code.expires_at && Date.parse(code.expires_at) <= now) {
    return "INVITATION_EXPIRED";
  }
  if (
    code.max_uses <= 0 || code.current_uses < 0 ||
    code.current_uses >= code.max_uses
  ) {
    return "INVITATION_EXHAUSTED";
  }
  return null;
}
