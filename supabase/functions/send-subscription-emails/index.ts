import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import { stripeReturnBase } from "../_shared/stripe-return-url.ts";
import { emailsMode, testRecipients } from "../_shared/subscription-emails.ts";
import { SUBSCRIPTION_EMAIL_FROM } from "../_shared/subscription-email-templates.ts";
import { isServiceCaller } from "../purge-expired-media/auth.ts";
import { resendSender } from "./resend.ts";
import { previewEmails, runSubscriptionEmails } from "./run.ts";
import { supabaseEmailStore } from "./store.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
  if (!isServiceCaller(req.headers.get("Authorization"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) {
    return enrollmentJson({ error: "Forbidden" }, 403);
  }

  const mode = emailsMode(Deno.env.get("SUBSCRIPTION_EMAILS_MODE"));
  const allowed = testRecipients(Deno.env.get("SUBSCRIPTION_EMAILS_TEST_RECIPIENTS"));
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const sender = apiKey ? resendSender(apiKey, SUBSCRIPTION_EMAIL_FROM) : null;
  const siteUrl = stripeReturnBase(null, Deno.env.get("FRONTEND_URL"));
  const body = await req.json().catch(() => ({})) as { action?: string; to?: string; subscriber_type?: string };

  try {
    if (body.action === "preview") {
      const to = (body.to ?? "").trim().toLowerCase();
      if (!sender) return enrollmentJson({ error: "RESEND_API_KEY is not configured" }, 503);
      if (!allowed.has(to)) return enrollmentJson({ error: "Recipient is not in SUBSCRIPTION_EMAILS_TEST_RECIPIENTS" }, 400);
      const type = body.subscriber_type === "CLUB" ? "CLUB" : "COACH";
      const now = new Date();
      const ids: string[] = [];
      for (const [index, email] of previewEmails(siteUrl, now, type).entries()) {
        ids.push((await sender.send(to, email, `preview:${type}:${index}:${now.getTime()}`)).id);
      }
      return enrollmentJson({ preview: true, sent: ids.length });
    }
    const summary = await runSubscriptionEmails({
      store: supabaseEmailStore(supabaseAdmin),
      sender,
      mode,
      allowed,
      siteUrl,
      now: new Date(),
    });
    return enrollmentJson(summary);
  } catch (error) {
    console.error("send-subscription-emails failed", error instanceof Error ? error.message : error);
    return enrollmentJson({ error: "Subscription emails could not be processed" }, 500);
  }
});
