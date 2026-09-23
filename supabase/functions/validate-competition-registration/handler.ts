import type { EnrollmentServices } from "../_shared/enrollment-pricing.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import { quoteCompetitionRegistration } from "../_shared/competition-registration.ts";

export function validateCompetitionRegistrationHandler({
  db,
  getUser,
  getUserRole,
}: EnrollmentServices) {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return enrollmentJson({ error: "Method not allowed" }, 405);
    }
    const user = await getUser(req);
    const body = await req.json();
    if (
      Array.isArray(body?.selections) && body.selections.some(
        (selection: unknown) =>
          selection !== null && typeof selection === "object" &&
          "childId" in selection,
      ) && (await getUserRole(user.id)) !== "PARENT"
    ) {
      return enrollmentJson({ error: "Doar părinții pot înscrie copii." }, 403);
    }
    const quote = await quoteCompetitionRegistration(
      db,
      user.id,
      body?.competitionId,
      body?.selections,
    );
    return enrollmentJson(quote);
  };
}
