import { enrollmentJson } from "../_shared/enrollment-pricing.ts";

export interface ExtensionRequest {
  subscriptionId: string;
  days: number;
  reason: string;
}

export interface ExtensionPlan {
  status: string;
  previousEnd: string | null;
  newEnd: string;
  stripeSubscriptionId: string | null;
}

export class ExtensionRpcError extends Error {
  constructor(message: string, readonly code: string | undefined) {
    super(message);
  }
}

export interface AdminExtendServices {
  getUser(req: Request): Promise<{ id: string }>;
  getUserRole(userId: string): Promise<string | null>;
  beginExtension(subscriptionId: string, days: number): Promise<ExtensionPlan>;
  stripeSubscriptionStatus(stripeSubscriptionId: string): Promise<string>;
  setStripeTrialEnd(stripeSubscriptionId: string, trialEndSeconds: number): Promise<void>;
  applyExtension(request: ExtensionRequest, adminId: string, newEnd: string): Promise<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE_STRIPE_STATUSES = new Set(["trialing", "active", "past_due"]);

export function parseExtensionRequest(body: unknown): ExtensionRequest | string {
  if (!body || typeof body !== "object") return "Cererea nu este validă.";
  const value = body as Record<string, unknown>;
  if (typeof value.subscriptionId !== "string" || !UUID.test(value.subscriptionId)) {
    return "Abonamentul nu este valid.";
  }
  if (
    typeof value.days !== "number" || !Number.isSafeInteger(value.days) ||
    value.days < 1 || value.days > 366
  ) {
    return "Alege între 1 și 366 de zile.";
  }
  if (typeof value.reason !== "string") return "Scrie motivul prelungirii.";
  const reason = value.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    return "Motivul trebuie să aibă între 3 și 500 de caractere.";
  }
  return { subscriptionId: value.subscriptionId, days: value.days, reason };
}

function planFailure(error: ExtensionRpcError) {
  if (error.message === "SUBSCRIPTION_NOT_FOUND" || error.code === "P0002") {
    return enrollmentJson({ error: "Abonamentul nu a fost găsit." }, 404);
  }
  if (error.message === "NO_END_DATE") {
    return enrollmentJson({
      error: "Abonamentul nu are încă o dată de încheiere, pentru că lansarea nu a fost setată. Nu e nimic de prelungit.",
    }, 409);
  }
  if (error.message === "INVALID_DAYS") {
    return enrollmentJson({ error: "Alege între 1 și 366 de zile." }, 400);
  }
  return enrollmentJson({ error: "Nu am putut pregăti prelungirea." }, 503);
}

export function adminExtendHandler(services: AdminExtendServices) {
  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const user = await services.getUser(req);
    if (await services.getUserRole(user.id) !== "ADMIN") {
      return enrollmentJson({ error: "Doar administratorii pot prelungi abonamente." }, 403);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return enrollmentJson({ error: "Cererea nu este validă." }, 400);
    }
    const request = parseExtensionRequest(body);
    if (typeof request === "string") return enrollmentJson({ error: request }, 400);

    let plan: ExtensionPlan;
    try {
      plan = await services.beginExtension(request.subscriptionId, request.days);
    } catch (error) {
      if (error instanceof ExtensionRpcError) return planFailure(error);
      return enrollmentJson({ error: "Nu am putut pregăti prelungirea." }, 503);
    }

    let stripeUpdated = false;
    if (plan.stripeSubscriptionId) {
      try {
        const status = await services.stripeSubscriptionStatus(plan.stripeSubscriptionId);
        if (LIVE_STRIPE_STATUSES.has(status)) {
          await services.setStripeTrialEnd(
            plan.stripeSubscriptionId,
            Math.floor(Date.parse(plan.newEnd) / 1000),
          );
          stripeUpdated = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : "eroare necunoscută";
        return enrollmentJson({
          error: `Stripe nu a acceptat prelungirea, deci nu am schimbat nimic: ${message}`,
        }, 502);
      }
    }

    try {
      const adjustmentId = await services.applyExtension(request, user.id, plan.newEnd);
      return enrollmentJson({ adjustmentId, newEnd: plan.newEnd, stripeUpdated });
    } catch {
      return enrollmentJson({
        error: stripeUpdated
          ? "Stripe a primit data nouă, dar nu am putut salva prelungirea. Reîncarcă pagina: starea se actualizează din Stripe."
          : "Nu am putut salva prelungirea.",
      }, 503);
    }
  };
}
