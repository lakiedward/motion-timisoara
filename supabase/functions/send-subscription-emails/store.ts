import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EmailInvoice, EmailSettings, EmailSubscription } from "../_shared/subscription-emails.ts";
import { type EmailStore, MAX_ATTEMPTS, type PlanInfo } from "./run.ts";

const STALE_PENDING_MS = 60 * 60 * 1000;

function fail(action: string, error: { message: string } | null) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export function supabaseEmailStore(db: SupabaseClient): EmailStore {
  const plans = new Map<string, PlanInfo | null>();

  return {
    async settings() {
      const { data, error } = await db.from("subscription_settings")
        .select("launch_at,launch_trial_days").eq("singleton", true).single();
      fail("subscription_settings", error);
      return data as EmailSettings;
    },

    async subscriptions() {
      const { data, error } = await db.from("subscriptions").select(
        "id,subscriber_type,coach_user_id,club_id,plan_code,status,trial_end,current_period_end,past_due_since,stripe_subscription_id",
      );
      fail("subscriptions", error);
      return (data ?? []) as EmailSubscription[];
    },

    async invoices(since) {
      const { data, error } = await db.from("subscription_invoices").select(
        "stripe_invoice_id,subscription_id,status,amount,currency,hosted_invoice_url,period_end,paid_at,updated_at",
      ).gte("updated_at", since).in("status", ["PAID", "FAILED"]);
      fail("subscription_invoices", error);
      return (data ?? []) as EmailInvoice[];
    },

    async recentlyEnded(since) {
      const { data, error } = await db.from("subscription_email_log").select("subscription_id")
        .eq("kind", "SUBSCRIPTION_ENDED").in("status", ["SENT", "PENDING"]).gte("created_at", since);
      fail("subscription_email_log ended", error);
      return new Set((data ?? []).map((row: { subscription_id: string }) => row.subscription_id));
    },

    async recipient(subscription) {
      let userId = subscription.coach_user_id;
      let clubName: string | null = null;
      if (subscription.subscriber_type === "CLUB" && subscription.club_id) {
        const { data, error } = await db.from("clubs").select("name,owner_user_id")
          .eq("id", subscription.club_id).maybeSingle();
        fail("clubs", error);
        userId = data?.owner_user_id ?? null;
        clubName = data?.name ?? null;
      }
      if (!userId) return { email: null, name: null, clubName };
      const { data, error } = await db.from("profiles").select("email,name,enabled").eq("id", userId).maybeSingle();
      fail("profiles", error);
      if (!data || data.enabled === false) return { email: null, name: null, clubName };
      const firstName = typeof data.name === "string" ? data.name.trim().split(/\s+/)[0] || null : null;
      return { email: data.email ?? null, name: firstName, clubName };
    },

    async plan(subscription) {
      if (!subscription.plan_code) return null;
      const key = `${subscription.subscriber_type}:${subscription.plan_code}`;
      if (!plans.has(key)) {
        const { data, error } = await db.from("subscription_plans").select("name,price_bani")
          .eq("code", subscription.plan_code).eq("subscriber_type", subscription.subscriber_type).maybeSingle();
        fail("subscription_plans", error);
        plans.set(key, (data as PlanInfo | null) ?? null);
      }
      return plans.get(key) ?? null;
    },

    async claim(due, recipientEmail) {
      const inserted = await db.from("subscription_email_log").upsert({
        subscription_id: due.subscriptionId,
        kind: due.kind,
        dedupe_key: due.dedupeKey,
        recipient_email: recipientEmail,
        status: "PENDING",
        attempts: 1,
      }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
      fail("subscription_email_log insert", inserted.error);
      if (inserted.data?.length) return { id: inserted.data[0].id };

      const { data: existing, error } = await db.from("subscription_email_log")
        .select("id,status,attempts,updated_at").eq("dedupe_key", due.dedupeKey).maybeSingle();
      fail("subscription_email_log read", error);
      if (!existing || existing.attempts >= MAX_ATTEMPTS) return null;
      const stalePending = existing.status === "PENDING" &&
        Date.now() - Date.parse(existing.updated_at) > STALE_PENDING_MS;
      if (existing.status !== "FAILED" && !stalePending) return null;
      const retried = await db.from("subscription_email_log")
        .update({ status: "PENDING", attempts: existing.attempts + 1, recipient_email: recipientEmail, error: null })
        .eq("id", existing.id).eq("status", existing.status).eq("attempts", existing.attempts).select("id");
      fail("subscription_email_log retry", retried.error);
      return retried.data?.length ? { id: existing.id } : null;
    },

    async finish(claim, result) {
      const { error } = await db.from("subscription_email_log").update({
        status: result.status,
        provider_message_id: result.providerId ?? null,
        error: result.error ?? null,
        sent_at: result.status === "SENT" ? new Date().toISOString() : null,
      }).eq("id", claim.id);
      fail("subscription_email_log finish", error);
    },
  };
}
