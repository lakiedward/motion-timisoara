import type { EnrollmentServices } from "../_shared/enrollment-pricing.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import { quoteCompetitionRegistration } from "../_shared/competition-registration.ts";
import { competitionPaymentRecipient } from "../_shared/competition-payment-recipient.ts";

export function createCompetitionRegistrationHandler({
  db,
  getUser,
  getUserRole,
}: EnrollmentServices) {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return enrollmentJson({ error: "Method not allowed" }, 405);
    }
    const user = await getUser(req);
    if ((await getUserRole(user.id)) !== "PARENT") {
      return enrollmentJson({ error: "Doar părinții pot înscrie copii." }, 403);
    }
    const body = await req.json();
    if (body?.paymentMethod !== "CARD" && body?.paymentMethod !== "CASH") {
      return enrollmentJson({ error: "Metoda de plată nu este validă." }, 400);
    }
    const quote = await quoteCompetitionRegistration(
      db,
      user.id,
      body?.competitionId,
      body?.selections,
    );
    const invalid = quote.results.find(
      (result) => !result.eligible || !result.pricingSnapshot,
    );
    if (invalid) {
      return enrollmentJson(
        { error: invalid.reason ?? "Înscrierea nu este validă." },
        409,
      );
    }
    if (
      quote.results.some(
        (result) => body.priceVersions?.[result.childId] !== result.priceVersion,
      )
    ) {
      return enrollmentJson(
        {
          error: "Prețul sau categoria s-a schimbat. Verifică din nou înscrierea.",
          code: "PRICE_CHANGED",
        },
        409,
      );
    }
    const paid = quote.results.some((result) => (result.amount ?? 0) > 0);
    if (paid && body.paymentMethod === "CASH" && !quote.allowCash) {
      return enrollmentJson(
        { error: "Plata cash nu este disponibilă pentru acest concurs." },
        409,
      );
    }
    if (paid && body.paymentMethod === "CARD") {
      await competitionPaymentRecipient(db, body.competitionId);
    }
    const billing = body.billingDetails;
    if (
      billing != null &&
      (typeof billing !== "object" ||
        Array.isArray(billing) ||
        ["name", "email", "addressLine1", "city", "postalCode"].some(
          (key) => typeof billing[key] !== "string" || billing[key].length > 500,
        ))
    ) {
      return enrollmentJson(
        { error: "Datele de facturare nu sunt valide." },
        400,
      );
    }
    const { data, error } = await db.rpc("save_competition_registration", {
      p_parent_id: user.id,
      p_competition_id: body.competitionId,
      p_method: paid ? body.paymentMethod : "CARD",
      p_quotes: quote.results.map((result) => ({
        childId: result.childId,
        categoryId: result.categoryId,
        amount: result.amount,
        currency: result.currency,
        priceVersion: result.priceVersion,
        snapshot: result.pricingSnapshot,
      })),
      p_billing: billing ?? null,
    });
    if (error) {
      const status = error.code === "42501"
        ? 403
        : error.code === "22023"
        ? 400
        : ["23505", "23514", "P0002"].includes(error.code)
        ? 409
        : 500;
      return enrollmentJson(
        {
          error: status === 500 ? "Nu am putut salva înscrierea. Reîncearcă." : error.message,
          ...(error.details === "PRICE_CHANGED" ? { code: "PRICE_CHANGED" } : {}),
        },
        status,
      );
    }
    if (!data?.enrollmentIds?.length) {
      return enrollmentJson({ error: "Înscrierea nu a fost salvată." }, 500);
    }
    const { createdEnrollmentIds: _createdEnrollmentIds, ...response } = data;
    return enrollmentJson(response);
  };
}
