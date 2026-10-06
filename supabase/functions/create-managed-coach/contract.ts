const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const payloadKeys = ["email", "name", "phone", "bio", "sportIds", "clubId"];

export type ManagedCoachRequest = {
  email: string;
  name: string;
  phone?: string;
  bio?: string;
  sportIds: string[];
  clubId?: string;
};

const failures = {
  UNAUTHORIZED: [401, "Sesiunea a expirat. Autentifică-te din nou."],
  FORBIDDEN: [403, "Nu ai permisiunea de a crea conturi de antrenor."],
  INVALID_REQUEST: [400, "Verifică datele pentru contul de antrenor."],
  CLUB_NOT_FOUND: [400, "Clubul nu este disponibil. Verifică selecția."],
  ACCOUNT_EXISTS: [409, "Există deja un cont cu acest email."],
  AUTH_CREATION_FAILED: [500, "Nu am putut crea contul de antrenor."],
  ROLE_SETUP_FAILED: [500, "Nu am putut activa rolul de antrenor."],
  COACH_PROFILE_FAILED: [500, "Nu am putut salva profilul de antrenor."],
  SPORTS_SETUP_FAILED: [500, "Nu am putut salva sporturile antrenorului."],
  CLUB_SETUP_FAILED: [500, "Nu am putut adăuga antrenorul în club."],
  VERIFICATION_FAILED: [500, "Nu am putut verifica noul cont de antrenor."],
  CREATION_INCOMPLETE: [
    500,
    "Contul de antrenor nu a fost finalizat. Administratorul trebuie să verifice contul incomplet înainte de o nouă încercare.",
  ],
  SERVER_ERROR: [
    500,
    "Nu am putut finaliza contul de antrenor. Încearcă din nou.",
  ],
} as const;

type ManagedCoachFailure = keyof typeof failures;

export type ManagedCoachDependencies = {
  getCaller: (
    token: string,
  ) => Promise<{ id: string; role: string | null } | null>;
  findOwnedClub: (callerId: string) => Promise<string | null>;
  clubExists: (clubId: string) => Promise<boolean>;
  createUser: (
    payload: ManagedCoachRequest,
    password: string,
    creationId: string,
  ) => Promise<
    { id: string } | { error: "ACCOUNT_EXISTS" | "AUTH_CREATION_FAILED" }
  >;
  setCoachRole: (userId: string) => Promise<void>;
  createCoachProfile: (userId: string, bio?: string) => Promise<string>;
  addSports: (coachProfileId: string, sportIds: string[]) => Promise<void>;
  addToClub: (coachProfileId: string, clubId: string) => Promise<void>;
  verifyCreatedCoach: (
    userId: string,
    coachProfileId: string,
    email: string,
    creationId: string,
  ) => Promise<boolean>;
  deleteCreatedUser: (userId: string, creationId: string) => Promise<void>;
};

export function parseManagedCoach(value: unknown): ManagedCoachRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => !payloadKeys.includes(key)) ||
    typeof input.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
    typeof input.name !== "string" || input.name.trim().length < 2 ||
    (input.phone !== undefined && typeof input.phone !== "string") ||
    (input.bio !== undefined && typeof input.bio !== "string") ||
    (input.clubId !== undefined &&
      (typeof input.clubId !== "string" || !uuid.test(input.clubId))) ||
    (input.sportIds !== undefined &&
      (!Array.isArray(input.sportIds) ||
        input.sportIds.some((id) => typeof id !== "string" || !uuid.test(id))))
  ) return null;
  return {
    email: input.email.trim(),
    name: input.name.trim(),
    phone: input.phone as string | undefined,
    bio: input.bio as string | undefined,
    sportIds: [...new Set((input.sportIds as string[] | undefined) ?? [])],
    clubId: input.clubId as string | undefined,
  };
}

function failure(code: ManagedCoachFailure): Response {
  const [status, error] = failures[code];
  return Response.json({ code, error }, { status });
}

function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from(
    crypto.getRandomValues(new Uint8Array(7)),
    (value) => alphabet[value % alphabet.length],
  ).join("");
  return `Motion-${suffix}`;
}

export function managedCoachHandler(dependencies: ManagedCoachDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    let createdUserId: string | undefined;
    const creationId = crypto.randomUUID();
    let failedStage: ManagedCoachFailure = "SERVER_ERROR";
    try {
      const token = /^Bearer\s+(\S+)$/i.exec(
        request.headers.get("Authorization") ?? "",
      )?.[1];
      if (!token) return failure("UNAUTHORIZED");
      const caller = await dependencies.getCaller(token);
      if (!caller) return failure("UNAUTHORIZED");
      if (caller.role !== "ADMIN" && caller.role !== "CLUB") {
        return failure("FORBIDDEN");
      }
      let value: unknown;
      try {
        value = await request.json();
      } catch {
        return failure("INVALID_REQUEST");
      }
      const payload = parseManagedCoach(value);
      if (!payload) return failure("INVALID_REQUEST");
      let targetClubId: string | null = null;
      if (caller.role === "CLUB") {
        targetClubId = await dependencies.findOwnedClub(caller.id);
        if (!targetClubId) return failure("CLUB_NOT_FOUND");
      } else if (payload.clubId) {
        if (!await dependencies.clubExists(payload.clubId)) {
          return failure("CLUB_NOT_FOUND");
        }
        targetClubId = payload.clubId;
      }
      const password = temporaryPassword();
      failedStage = "AUTH_CREATION_FAILED";
      const created = await dependencies.createUser(
        payload,
        password,
        creationId,
      );
      if ("error" in created) return failure(created.error);
      if (!uuid.test(created.id) || created.id === caller.id) {
        return failure("AUTH_CREATION_FAILED");
      }
      createdUserId = created.id;
      failedStage = "ROLE_SETUP_FAILED";
      await dependencies.setCoachRole(createdUserId);
      failedStage = "COACH_PROFILE_FAILED";
      const coachProfileId = await dependencies.createCoachProfile(
        createdUserId,
        payload.bio,
      );
      if (!uuid.test(coachProfileId)) throw new Error("Coach profile missing");
      if (payload.sportIds.length) {
        failedStage = "SPORTS_SETUP_FAILED";
        await dependencies.addSports(coachProfileId, payload.sportIds);
      }
      if (targetClubId) {
        failedStage = "CLUB_SETUP_FAILED";
        await dependencies.addToClub(coachProfileId, targetClubId);
      }
      failedStage = "VERIFICATION_FAILED";
      const ready = await dependencies.verifyCreatedCoach(
        createdUserId,
        coachProfileId,
        payload.email,
        creationId,
      );
      if (!ready) throw new Error("Created coach verification failed");
      return Response.json({
        userId: createdUserId,
        email: payload.email,
        tempPassword: password,
        clubId: targetClubId,
        message: "Antrenorul a fost creat.",
      });
    } catch {
      if (createdUserId) {
        try {
          await dependencies.deleteCreatedUser(createdUserId, creationId);
        } catch {
          return failure("CREATION_INCOMPLETE");
        }
      }
      return failure(failedStage);
    }
  };
}
