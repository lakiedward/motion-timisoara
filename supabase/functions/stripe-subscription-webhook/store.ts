import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PlanRef, SubscriptionPatch, SubscriptionRow } from "../_shared/subscription-sync.ts";
import type { SubscriptionStore } from "./handler.ts";

const ROW_COLUMNS = [
  "id",
  "subscriber_type",
  "coach_user_id",
  "club_id",
  "plan_code",
  "scheduled_plan_code",
  "status",
  "trial_end",
  "current_period_end",
  "past_due_since",
  "cancel_at_period_end",
  "stripe_customer_id",
  "stripe_subscription_id",
  "terms_version",
  "terms_accepted_at",
  "updated_at",
].join(",");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(action: string, error: { message: string } | null) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export function supabaseSubscriptionStore(db: SupabaseClient): SubscriptionStore {
  const rowBy = async (column: string, value: string, type?: string) => {
    let query = db.from("subscriptions").select(ROW_COLUMNS).eq(column, value);
    if (type) query = query.eq("subscriber_type", type);
    const { data, error } = await query.maybeSingle();
    fail(`subscriptions by ${column}`, error);
    return data as SubscriptionRow | null;
  };

  return {
    async beginEvent(eventId, type) {
      const { data, error } = await db.from("subscription_events").select("processed_at")
        .eq("stripe_event_id", eventId).maybeSingle();
      fail("subscription_events read", error);
      if (data?.processed_at) return "done";
      if (!data) {
        const insert = await db.from("subscription_events")
          .upsert({ stripe_event_id: eventId, type }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
        fail("subscription_events insert", insert.error);
      }
      return "process";
    },

    async finishEvent(eventId, { processed, note }) {
      const { error } = await db.from("subscription_events")
        .update({ processed_at: processed ? new Date().toISOString() : null, error: note })
        .eq("stripe_event_id", eventId);
      fail("subscription_events update", error);
    },

    async findRow({ subscriptionId, customerId, rowId, subscriberType, subscriberId }) {
      const bySubscription = await rowBy("stripe_subscription_id", subscriptionId);
      if (bySubscription) return bySubscription;
      if (rowId && UUID.test(rowId)) {
        const byId = await rowBy("id", rowId);
        if (byId) return byId;
      }
      if (subscriberType && subscriberId) {
        const column = subscriberType === "COACH" ? "coach_user_id" : "club_id";
        const bySubscriber = await rowBy(column, subscriberId, subscriberType);
        if (bySubscriber) return bySubscriber;
      }
      return customerId ? await rowBy("stripe_customer_id", customerId) : null;
    },

    async createRow(type, subscriberId, patch) {
      const owner = type === "COACH" ? { coach_user_id: subscriberId } : { club_id: subscriberId };
      const { error } = await db.from("subscriptions").insert({ subscriber_type: type, ...owner, ...patch });
      fail("subscriptions insert", error);
    },

    async updateRow(id, expectedUpdatedAt, patch: SubscriptionPatch) {
      const { data, error } = await db.from("subscriptions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("updated_at", expectedUpdatedAt)
        .select("id");
      fail("subscriptions update", error);
      return (data ?? []).length === 1;
    },

    async planForPrice(priceId) {
      const { data, error } = await db.from("subscription_plans").select("code,subscriber_type")
        .eq("stripe_price_id", priceId).maybeSingle();
      fail("subscription_plans read", error);
      return data as PlanRef | null;
    },
  };
}
