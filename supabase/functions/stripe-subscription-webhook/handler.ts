import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import {
  changedFields,
  iso,
  type PlanRef,
  type StripeSubscriptionState,
  type SubscriberType,
  type SubscriptionPatch,
  type SubscriptionRow,
  syncDecision,
} from "../_shared/subscription-sync.ts";

export const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

const MAX_ATTEMPTS = 3;

export interface SubscriberKeys {
  subscriptionId: string;
  customerId: string | null;
  rowId: string | null;
  subscriberType: SubscriberType | null;
  subscriberId: string | null;
}

export interface SubscriptionStore {
  beginEvent(eventId: string, type: string): Promise<"process" | "done">;
  finishEvent(eventId: string, result: { processed: boolean; note: string | null }): Promise<void>;
  findRow(keys: SubscriberKeys): Promise<SubscriptionRow | null>;
  createRow(type: SubscriberType, subscriberId: string, patch: SubscriptionPatch): Promise<void>;
  updateRow(id: string, expectedUpdatedAt: string, patch: SubscriptionPatch): Promise<boolean>;
  planForPrice(priceId: string): Promise<PlanRef | null>;
}

export interface SubscriptionWebhookServices {
  store: SubscriptionStore;
  verifyEvent: (body: string, signature: string) => Promise<Stripe.Event>;
  subscription: (id: string) => Promise<StripeSubscriptionState>;
  now?: () => Date;
}

interface EventTarget {
  keys: SubscriberKeys;
  terms: SubscriptionPatch;
}

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id ?? null;

function subscriberFromMetadata(metadata: Record<string, string> | null | undefined, rowId?: string | null) {
  const type = metadata?.subscriber_type;
  const id = metadata?.subscriber_id;
  const row = { rowId: rowId || metadata?.subscription_id || null };
  if ((type === "COACH" || type === "CLUB") && id) {
    return { ...row, subscriberType: type as SubscriberType, subscriberId: id };
  }
  return { ...row, subscriberType: null, subscriberId: null };
}

export function eventTarget(event: Stripe.Event): EventTarget | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = idOf(session.subscription);
    if (session.mode !== "subscription" || !subscriptionId) return null;
    const version = session.metadata?.terms_version;
    const terms: SubscriptionPatch = session.consent?.terms_of_service === "accepted" && version
      ? { terms_version: version, terms_accepted_at: iso(event.created) }
      : {};
    return {
      keys: { subscriptionId, customerId: idOf(session.customer), ...subscriberFromMetadata(session.metadata, session.client_reference_id) },
      terms,
    };
  }
  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    return {
      keys: {
        subscriptionId: subscription.id,
        customerId: idOf(subscription.customer),
        ...subscriberFromMetadata(subscription.metadata),
      },
      terms: {},
    };
  }
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = idOf(invoice.subscription);
  if (!subscriptionId) return null;
  return {
    keys: {
      subscriptionId,
      customerId: idOf(invoice.customer),
      ...subscriberFromMetadata(invoice.subscription_details?.metadata),
    },
    terms: {},
  };
}

async function syncOnce(services: SubscriptionWebhookServices, target: EventTarget): Promise<string | null> {
  const { store } = services;
  const row = await store.findRow(target.keys);
  const subscription = await services.subscription(target.keys.subscriptionId);
  const subscriberType = row?.subscriber_type ?? target.keys.subscriberType;
  const subscriberId = row ? null : target.keys.subscriberId;
  if (!subscriberType || (!row && !subscriberId)) return "skipped: subscriber unknown";
  const plan = subscription.price_id ? await store.planForPrice(subscription.price_id) : null;
  const decision = syncDecision(row, subscription, plan, subscriberType, (services.now ?? (() => new Date()))());
  const patch = { ...(decision.kind === "apply" ? decision.patch : {}), ...target.terms };
  if (!row) {
    if (decision.kind === "skip") return `skipped: ${decision.reason}`;
    await store.createRow(subscriberType, subscriberId!, patch);
    return "created";
  }
  const changed = changedFields(row, patch);
  if (Object.keys(changed).length === 0) {
    return decision.kind === "skip" ? `skipped: ${decision.reason}` : "unchanged";
  }
  return await store.updateRow(row.id, row.updated_at, changed) ? "updated" : null;
}

export function subscriptionWebhookHandler(services: SubscriptionWebhookServices) {
  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const signature = req.headers.get("stripe-signature");
    if (!signature) return enrollmentJson({ error: "Missing signature" }, 400);
    let event: Stripe.Event;
    try {
      event = await services.verifyEvent(await req.text(), signature);
    } catch {
      return enrollmentJson({ error: "Invalid signature" }, 400);
    }
    if (!HANDLED_EVENTS.has(event.type)) return enrollmentJson({ received: true, ignored: event.type });
    const target = eventTarget(event);
    if (!target) return enrollmentJson({ received: true, ignored: "not a subscription event" });

    const { store } = services;
    try {
      if (await store.beginEvent(event.id, event.type) === "done") {
        return enrollmentJson({ received: true, duplicate: true });
      }
    } catch {
      return enrollmentJson({ error: "Event could not be recorded" }, 500);
    }
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const outcome = await syncOnce(services, target);
        if (outcome !== null) {
          const note = outcome.startsWith("skipped") ? outcome : null;
          await store.finishEvent(event.id, { processed: true, note });
          return enrollmentJson({ received: true, type: event.type, outcome });
        }
      }
      throw new Error("Subscription row kept changing during sync");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.finishEvent(event.id, { processed: false, note: message.slice(0, 500) }).catch(() => undefined);
      return enrollmentJson({ error: "Subscription state could not be synchronized" }, 500);
    }
  };
}
