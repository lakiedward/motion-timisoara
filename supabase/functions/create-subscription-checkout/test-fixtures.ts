import {
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SubscriptionSettings,
} from "../_shared/subscription-billing.ts";
import {
  type OpenCheckoutSession,
  type SubscriptionCheckoutDependencies,
  subscriptionCheckoutHandler,
  type SubscriptionCheckoutParams,
} from "./contract.ts";
import {
  type BillingPortalDependencies,
  billingPortalHandler,
  type BillingPortalParams,
} from "../billing-portal/contract.ts";

export const coachId = "00000000-0000-0000-0000-000000000001";
export const clubOwnerId = "00000000-0000-0000-0000-000000000002";
export const clubId = "00000000-0000-0000-0000-000000000003";
export const subscriptionId = "00000000-0000-0000-0000-000000000004";
export const now = Date.parse("2026-11-10T10:00:00Z");
export const day = 86_400_000;
export const site = "https://motionromania.ro";

export function assert(
  value: unknown,
  message = "Assertion failed",
): asserts value {
  if (!value) throw new Error(message);
}

export function post(
  body: unknown,
  origin: string | null = site,
  authorization: string | null = "Bearer user-jwt",
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  if (authorization) headers.set("Authorization", authorization);
  return new Request("https://local.test/fn", {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const plans: Record<string, SubscriptionPlan> = {
  COACH: {
    code: "COACH",
    subscriber_type: "COACH",
    coach_limit: null,
    stripe_price_id: "price_coach",
    active: true,
  },
  CLUB_START: {
    code: "CLUB_START",
    subscriber_type: "CLUB",
    coach_limit: 3,
    stripe_price_id: "price_start",
    active: true,
  },
  CLUB: {
    code: "CLUB",
    subscriber_type: "CLUB",
    coach_limit: 10,
    stripe_price_id: "price_club",
    active: true,
  },
  CLUB_PRO: {
    code: "CLUB_PRO",
    subscriber_type: "CLUB",
    coach_limit: null,
    stripe_price_id: "price_pro",
    active: true,
  },
  OLD: {
    code: "OLD",
    subscriber_type: "COACH",
    coach_limit: null,
    stripe_price_id: "price_old",
    active: false,
  },
  DRAFT: {
    code: "DRAFT",
    subscriber_type: "COACH",
    coach_limit: null,
    stripe_price_id: null,
    active: true,
  },
};

type Options = {
  role?: string | null;
  club?: boolean;
  subscription?: Partial<SubscriptionRecord> | null;
  settings?: SubscriptionSettings;
  coachCount?: number;
  savedCustomer?: string;
  failCheckout?: unknown;
  openSessions?: OpenCheckoutSession[];
};

function lookups(options: Options, calls: string[]) {
  const role = options.role === undefined ? "COACH" : options.role;
  const type = role === "CLUB" ? "CLUB" : "COACH";
  return {
    getCaller: (token: string) => {
      calls.push("caller");
      if (token !== "user-jwt") return Promise.resolve(null);
      return Promise.resolve({
        id: role === "CLUB" ? clubOwnerId : coachId,
        email: "user@local.test",
        role,
      });
    },
    findOwnedClub: (userId: string) => {
      assert(userId === clubOwnerId);
      calls.push("club");
      return Promise.resolve(
        options.club === false
          ? null
          : { id: clubId, email: "club@local.test", name: "Club Test" },
      );
    },
    findSubscription: (subscriber: { type: string; id: string }) => {
      calls.push(`subscription:${subscriber.type}:${subscriber.id}`);
      if (options.subscription === null) return Promise.resolve(null);
      return Promise.resolve({
        id: subscriptionId,
        subscriber_type: type,
        plan_code: null,
        status: "trialing",
        trial_end: new Date(now + 20 * day).toISOString(),
        stripe_customer_id: null,
        stripe_subscription_id: null,
        ...options.subscription,
      } as SubscriptionRecord);
    },
  };
}

export function checkoutFixture(options: Options = {}) {
  const calls: string[] = [];
  const sessions: { params: SubscriptionCheckoutParams; key: string }[] = [];
  const customers: {
    email?: string;
    name?: string;
    key: string;
    metadata: Record<string, string>;
  }[] = [];
  const dependencies: SubscriptionCheckoutDependencies = {
    ...lookups(options, calls),
    findPlan: (code) => {
      calls.push(`plan:${code}`);
      return Promise.resolve(plans[code] ?? null);
    },
    getSettings: () =>
      Promise.resolve(
        options.settings ??
          { launch_at: "2026-11-06T00:00:00Z", launch_trial_days: 90 },
      ),
    countClubCoaches: (id) => {
      assert(id === clubId);
      calls.push("count");
      return Promise.resolve(options.coachCount ?? 0);
    },
    createCustomer: (params, key) => {
      customers.push({ ...params, key });
      return Promise.resolve("cus_new");
    },
    saveCustomer: (id, customerId) => {
      assert(id === subscriptionId && customerId === "cus_new");
      calls.push("save-customer");
      return Promise.resolve(options.savedCustomer ?? customerId);
    },
    listOpenSessions: (customerId) => {
      calls.push(`open:${customerId}`);
      return Promise.resolve(options.openSessions ?? []);
    },
    expireSession: (id) => {
      calls.push(`expire:${id}`);
      return Promise.resolve();
    },
    createCheckoutSession: (params, key) => {
      if (options.failCheckout) return Promise.reject(options.failCheckout);
      sessions.push({ params, key });
      return Promise.resolve({
        id: "cs_test",
        url: "https://checkout.stripe.com/c/pay/cs_test",
      });
    },
    termsVersion: "1.2",
    now: () => now,
  };
  return {
    handler: subscriptionCheckoutHandler(dependencies),
    calls,
    sessions,
    customers,
  };
}

export function portalFixture(
  options: Options & { configuration?: string | null } = {},
) {
  const calls: string[] = [];
  const portals: BillingPortalParams[] = [];
  const dependencies: BillingPortalDependencies = {
    ...lookups(options, calls),
    createPortalSession: (params) => {
      portals.push(params);
      return Promise.resolve("https://billing.stripe.com/p/session/test");
    },
    portalConfiguration: options.configuration ?? null,
  };
  return { handler: billingPortalHandler(dependencies), calls, portals };
}

export async function expectFailure(
  response: Response,
  status: number,
  code: string,
) {
  const body = await response.json();
  assert(
    response.status === status,
    `expected ${status}, got ${response.status} ${JSON.stringify(body)}`,
  );
  assert(body.code === code, `expected ${code}, got ${body.code}`);
  return body;
}
