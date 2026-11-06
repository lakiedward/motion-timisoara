import { enrollmentJson } from "../_shared/enrollment-pricing.ts";

export interface SetEnabledRequest {
  userId: string;
  enabled: boolean;
}

export interface TargetAccount {
  deletedAt: string | null;
}

export interface AdminSetEnabledServices {
  getUser(req: Request): Promise<{ id: string }>;
  getUserRole(userId: string): Promise<string | null>;
  getTarget(userId: string): Promise<TargetAccount | null>;
  setAuthBan(userId: string, banned: boolean): Promise<void>;
  setProfileEnabled(userId: string, enabled: boolean): Promise<void>;
}

export const AUTH_BAN_DURATION = "876000h";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSetEnabledRequest(body: unknown): SetEnabledRequest | string {
  if (!body || typeof body !== "object") return "Cererea nu este validă.";
  const value = body as Record<string, unknown>;
  if (typeof value.userId !== "string" || !UUID.test(value.userId)) {
    return "Utilizatorul nu este valid.";
  }
  if (typeof value.enabled !== "boolean") return "Alege dacă activezi sau dezactivezi contul.";
  return { userId: value.userId, enabled: value.enabled };
}

export function adminSetEnabledHandler(services: AdminSetEnabledServices) {
  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const admin = await services.getUser(req);
    if (await services.getUserRole(admin.id) !== "ADMIN") {
      return enrollmentJson({ error: "Doar administratorii pot activa sau dezactiva conturi." }, 403);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return enrollmentJson({ error: "Cererea nu este validă." }, 400);
    }
    const request = parseSetEnabledRequest(body);
    if (typeof request === "string") return enrollmentJson({ error: request }, 400);
    if (request.userId === admin.id && !request.enabled) {
      return enrollmentJson({ error: "Nu îți poți dezactiva propriul cont." }, 409);
    }

    let target: TargetAccount | null;
    try {
      target = await services.getTarget(request.userId);
    } catch {
      return enrollmentJson({ error: "Nu am putut citi contul." }, 503);
    }
    if (!target) return enrollmentJson({ error: "Contul nu a fost găsit." }, 404);
    if (target.deletedAt !== null) {
      return enrollmentJson({ error: "Contul a fost șters și rămâne blocat." }, 409);
    }

    try {
      await services.setAuthBan(request.userId, !request.enabled);
    } catch {
      return enrollmentJson({
        error: "Supabase Auth nu a acceptat schimbarea, deci contul a rămas cum era. Încearcă din nou.",
      }, 502);
    }

    try {
      await services.setProfileEnabled(request.userId, request.enabled);
    } catch {
      return enrollmentJson({
        error: request.enabled
          ? "Blocarea din Auth a fost scoasă, dar profilul a rămas dezactivat. Apasă din nou Activează."
          : "Contul e blocat în Auth, dar profilul a rămas activ. Apasă din nou Dezactivează.",
      }, 503);
    }

    return enrollmentJson({ userId: request.userId, enabled: request.enabled });
  };
}
