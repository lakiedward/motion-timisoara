import type { EnrollmentServices } from "../_shared/enrollment-pricing.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";

export function cancelDraftHandler({ db, getUser }: Pick<EnrollmentServices, "db" | "getUser">) {
  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const user = await getUser(req);
    const body = await req.json();
    const ids: unknown = body.enrollmentIds ?? (body.enrollmentId ? [body.enrollmentId] : []);
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string" || !id)) {
      return enrollmentJson({ error: "enrollmentId or enrollmentIds is required" }, 400);
    }
    const cancelled: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const id of new Set(ids as string[])) {
      const { data, error } = await db.rpc("cancel_unaccepted_enrollment_draft", {
        p_enrollment_id: id, p_parent_id: user.id,
      });
      if (error || !data || typeof data.cancelled !== "boolean") {
        skipped.push({ id, reason: "could_not_verify_draft" });
      } else if (data.cancelled) {
        cancelled.push(id);
      } else {
        skipped.push({ id, reason: data.reason });
      }
    }
    return enrollmentJson({ success: skipped.length === 0, cancelled, skipped });
  };
}
