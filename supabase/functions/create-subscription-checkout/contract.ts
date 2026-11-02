import {
  billingErrorResponse,
  billingFailure,
  type BillingLookup,
  checkoutTrialEnd,
  hasLiveStripeSubscription,
  readJsonObject,
  resolveBillingContext,
  type Subscriber,
  subscriptionPagePath,
  type SubscriptionPlan,
  type SubscriptionSettings,
} from "../_shared/subscription-billing.ts";

export type CheckoutCustomerParams = {
  email?: string;
  name?: string;
  preferred_locales: string[];
  metadata: Record<string, string>;
};

export type SubscriptionCheckoutParams = {
  mode: "subscription";
  locale: "ro";
  currency: "ron";
  adaptive_pricing: { enabled: false };
  customer: string;
  client_reference_id: string;
  line_items: { price: string; quantity: number }[];
  payment_method_types: ["card"];
  billing_address_collection: "required";
  customer_update: { address: "auto"; name: "auto" };
  consent_collection: { terms_of_service: "required" };
  custom_text: { terms_of_service_acceptance: { message: string } };
  metadata: Record<string, string>;
  subscription_data: {
    metadata: Record<string, string>;
    trial_end?: number;
  };
  expires_at: number;
  success_url: string;
  cancel_url: string;
};

export type OpenCheckoutSession = {
  id: string;
  url: string | null;
  mode: string;
  successUrl: string | null;
  metadata: Record<string, string>;
};

export type SubscriptionCheckoutDependencies = BillingLookup & {
  findPlan: (code: string) => Promise<SubscriptionPlan | null>;
  getSettings: () => Promise<SubscriptionSettings>;
  countClubCoaches: (clubId: string) => Promise<number>;
  createCustomer: (
    params: CheckoutCustomerParams,
    idempotencyKey: string,
  ) => Promise<string>;
  saveCustomer: (subscriptionId: string, customerId: string) => Promise<string>;
  listOpenSessions: (customerId: string) => Promise<OpenCheckoutSession[]>;
  expireSession: (sessionId: string) => Promise<void>;
  createCheckoutSession: (
    params: SubscriptionCheckoutParams,
    idempotencyKey: string,
  ) => Promise<{ id: string; url: string | null }>;
  termsVersion: string;
  now: () => number;
};

export const CHECKOUT_REVISION = "1";

const planCodePattern = /^[A-Z][A-Z_]{1,31}$/;

export function parseCheckoutRequest(
  value: Record<string, unknown> | null,
): { planCode: string } | null {
  if (!value) return null;
  if (Object.keys(value).some((key) => key !== "planCode")) return null;
  if (typeof value.planCode !== "string") return null;
  const planCode = value.planCode.trim();
  return planCodePattern.test(planCode) ? { planCode } : null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function subscriberMetadata(
  subscriber: Subscriber,
  subscriptionId: string,
): Record<string, string> {
  return {
    subscription_id: subscriptionId,
    subscriber_type: subscriber.type,
    subscriber_id: subscriber.id,
  };
}

export function subscriptionCheckoutHandler(
  dependencies: SubscriptionCheckoutDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    try {
      const context = await resolveBillingContext(request, dependencies);
      const payload = parseCheckoutRequest(await readJsonObject(request));
      if (!payload) return billingFailure("INVALID_REQUEST");
      const { origin, subscriber, subscription } = context;

      const plan = await dependencies.findPlan(payload.planCode);
      if (!plan || !plan.active) return billingFailure("PLAN_NOT_FOUND");
      if (plan.subscriber_type !== subscriber.type) {
        return billingFailure("PLAN_NOT_ALLOWED");
      }
      if (!plan.stripe_price_id) return billingFailure("PLAN_NOT_READY");
      if (hasLiveStripeSubscription(subscription)) {
        return billingFailure("ALREADY_SUBSCRIBED");
      }

      if (subscriber.type === "CLUB" && plan.coach_limit !== null) {
        const coachCount = await dependencies.countClubCoaches(subscriber.id);
        if (coachCount > plan.coach_limit) {
          return billingFailure("PLAN_BELOW_COACH_COUNT", {
            coachCount,
            coachLimit: plan.coach_limit,
            coachesToRemove: coachCount - plan.coach_limit,
          });
        }
      }

      const now = dependencies.now();
      const trial = checkoutTrialEnd(
        subscription,
        await dependencies.getSettings(),
        now,
      );
      if ("error" in trial) return billingFailure(trial.error);

      const metadata = subscriberMetadata(subscriber, subscription.id);
      let customerId = subscription.stripe_customer_id;
      if (!customerId) {
        const created = await dependencies.createCustomer(
          {
            ...(subscriber.email ? { email: subscriber.email } : {}),
            ...(subscriber.name ? { name: subscriber.name } : {}),
            preferred_locales: ["ro"],
            metadata,
          },
          `subscription-customer-${subscription.id}`,
        );
        customerId = await dependencies.saveCustomer(subscription.id, created);
      }

      const page = `${origin}${subscriptionPagePath(subscriber.type)}`;
      const minute = Math.floor(now / 60_000);
      const sessionMetadata = {
        ...metadata,
        plan_code: plan.code,
        terms_version: dependencies.termsVersion,
        checkout_revision: CHECKOUT_REVISION,
      };
      const params: SubscriptionCheckoutParams = {
        mode: "subscription",
        locale: "ro",
        currency: "ron",
        adaptive_pricing: { enabled: false },
        customer: customerId,
        client_reference_id: subscription.id,
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        payment_method_types: ["card"],
        billing_address_collection: "required",
        customer_update: { address: "auto", name: "auto" },
        consent_collection: { terms_of_service: "required" },
        custom_text: {
          terms_of_service_acceptance: {
            message:
              `Accept [Termenii și condițiile](${origin}/termeni) Motion România, versiunea ${dependencies.termsVersion}.`,
          },
        },
        metadata: sessionMetadata,
        subscription_data: {
          metadata: sessionMetadata,
          ...(trial.trialEnd === null
            ? {}
            : { trial_end: Math.floor(trial.trialEnd / 1000) }),
        },
        expires_at: minute * 60 + 45 * 60,
        success_url:
          `${page}?abonament=reusit&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${page}?abonament=anulat`,
      };
      for (const open of await dependencies.listOpenSessions(customerId)) {
        if (open.mode !== "subscription") continue;
        const same = open.url && open.successUrl === params.success_url &&
          open.metadata.plan_code === plan.code &&
          open.metadata.subscription_id === subscription.id &&
          open.metadata.terms_version === dependencies.termsVersion &&
          open.metadata.checkout_revision === CHECKOUT_REVISION;
        if (same) return Response.json({ url: open.url, sessionId: open.id });
        await dependencies.expireSession(open.id);
      }
      const session = await dependencies.createCheckoutSession(
        params,
        `subscription-checkout-${await sha256(JSON.stringify(params))}`,
      );
      if (!session.url) return billingFailure("STRIPE_ERROR");
      return Response.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      return billingErrorResponse(error);
    }
  };
}
