export type SubscriberType = "COACH" | "CLUB";

export type BillingCaller = {
  id: string;
  email: string | null;
  role: string | null;
};

export type Subscriber =
  | { type: "COACH"; id: string; email: string | null; name: string | null }
  | { type: "CLUB"; id: string; email: string | null; name: string | null };

export type SubscriptionRecord = {
  id: string;
  subscriber_type: SubscriberType;
  plan_code: string | null;
  status: string;
  trial_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type SubscriptionPlan = {
  code: string;
  subscriber_type: SubscriberType;
  coach_limit: number | null;
  stripe_price_id: string | null;
  active: boolean;
};

export type SubscriptionSettings = {
  launch_at: string | null;
  launch_trial_days: number;
};

export type BillingContext = {
  origin: string;
  caller: BillingCaller;
  subscriber: Subscriber;
  subscription: SubscriptionRecord;
};

export type BillingLookup = {
  getCaller: (token: string) => Promise<BillingCaller | null>;
  findOwnedClub: (
    userId: string,
  ) => Promise<
    { id: string; email: string | null; name: string | null } | null
  >;
  findSubscription: (
    subscriber: Subscriber,
  ) => Promise<SubscriptionRecord | null>;
};

const failures = {
  ORIGIN_NOT_ALLOWED: [403, "Cererea nu este permisă."],
  UNAUTHORIZED: [401, "Sesiunea a expirat. Autentifică-te din nou."],
  ROLE_NOT_ALLOWED: [
    403,
    "Abonamentele sunt doar pentru antrenori și cluburi.",
  ],
  INVALID_REQUEST: [400, "Cererea nu este validă."],
  SUBSCRIBER_NOT_FOUND: [404, "Nu am găsit clubul acestui cont."],
  SUBSCRIPTION_MISSING: [
    409,
    "Abonamentul contului nu este încă pregătit. Încearcă mai târziu.",
  ],
  PLAN_NOT_FOUND: [404, "Planul ales nu există."],
  PLAN_NOT_ALLOWED: [403, "Planul ales nu este pentru tipul tău de cont."],
  PLAN_NOT_READY: [503, "Planul ales nu poate fi plătit încă."],
  PLAN_BELOW_COACH_COUNT: [
    409,
    "Clubul are mai mulți antrenori decât permite planul ales.",
  ],
  ALREADY_SUBSCRIBED: [
    409,
    "Ai deja un abonament. Îl poți gestiona din pagina abonamentului.",
  ],
  LAUNCH_PENDING: [
    409,
    "Perioada gratuită de lansare nu are încă o dată de final. Vei putea alege abonamentul după lansare.",
  ],
  NO_BILLING_ACCOUNT: [409, "Nu ai încă un abonament plătit de gestionat."],
  PLAN_CHANGE_CLUB_ONLY: [403, "Doar cluburile pot schimba pachetul."],
  SUBSCRIPTION_PAST_DUE: [
    409,
    "Plata lunară nu a trecut. Actualizează întâi cardul din Gestionează abonamentul.",
  ],
  SUBSCRIPTION_CANCELED: [
    409,
    "Abonamentul este anulat. Reactivează-l întâi din Gestionează abonamentul.",
  ],
  PAYMENT_FAILED: [
    402,
    "Plata diferenței nu a trecut. Pachetul a rămas cel vechi. Verifică cardul și încearcă din nou.",
  ],
  STRIPE_NOT_CONFIGURED: [
    503,
    "Plățile cu cardul nu sunt încă activate pe platformă.",
  ],
  STRIPE_ERROR: [503, "Nu am putut deschide Stripe. Încearcă din nou."],
  SERVER_ERROR: [500, "Nu am putut pregăti abonamentul. Încearcă din nou."],
} as const;

export type BillingFailure = keyof typeof failures;

export function billingFailure(
  code: BillingFailure,
  details: Record<string, number | string> = {},
): Response {
  const [status, error] = failures[code];
  return Response.json({ code, error, ...details }, { status });
}

const allowedOrigins = [
  /^https:\/\/(www\.)?motionromania\.ro$/,
  /^https:\/\/master--motiontimisoara\.netlify\.app$/,
  /^https:\/\/deploy-preview-\d{1,6}--motiontimisoara\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/,
];

export function allowedBillingOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return allowedOrigins.some((pattern) => pattern.test(origin)) ? origin : null;
}

export function subscriptionPagePath(type: SubscriberType): string {
  return type === "CLUB" ? "/club/abonament" : "/coach/abonament";
}

const DAY_MS = 86_400_000;
export const MIN_TRIAL_MS = 48 * 3_600_000;

export function effectiveTrialEnd(
  subscription: Pick<SubscriptionRecord, "trial_end">,
  settings: SubscriptionSettings,
): number | null {
  if (subscription.trial_end) return Date.parse(subscription.trial_end);
  if (!settings.launch_at) return null;
  return Date.parse(settings.launch_at) + settings.launch_trial_days * DAY_MS;
}

export function checkoutTrialEnd(
  subscription: Pick<SubscriptionRecord, "status" | "trial_end">,
  settings: SubscriptionSettings,
  now: number,
): { trialEnd: number | null } | { error: "LAUNCH_PENDING" } {
  if (subscription.status !== "trialing") return { trialEnd: null };
  const end = effectiveTrialEnd(subscription, settings);
  if (end === null || Number.isNaN(end)) return { error: "LAUNCH_PENDING" };
  return { trialEnd: end - now >= MIN_TRIAL_MS ? end : null };
}

export function hasLiveStripeSubscription(
  subscription: SubscriptionRecord,
): boolean {
  return Boolean(subscription.stripe_subscription_id) &&
    subscription.status !== "expired";
}

function bearerToken(request: Request): string | null {
  return /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "")
    ?.[1] ?? null;
}

export async function resolveBillingContext(
  request: Request,
  lookup: BillingLookup,
): Promise<BillingContext> {
  const origin = allowedBillingOrigin(request.headers.get("Origin"));
  if (!origin) throw billingFailure("ORIGIN_NOT_ALLOWED");
  const token = bearerToken(request);
  if (!token) throw billingFailure("UNAUTHORIZED");
  const caller = await lookup.getCaller(token);
  if (!caller) throw billingFailure("UNAUTHORIZED");
  let subscriber: Subscriber;
  if (caller.role === "COACH") {
    subscriber = {
      type: "COACH",
      id: caller.id,
      email: caller.email,
      name: null,
    };
  } else if (caller.role === "CLUB") {
    const club = await lookup.findOwnedClub(caller.id);
    if (!club) throw billingFailure("SUBSCRIBER_NOT_FOUND");
    subscriber = {
      type: "CLUB",
      id: club.id,
      email: club.email ?? caller.email,
      name: club.name,
    };
  } else {
    throw billingFailure("ROLE_NOT_ALLOWED");
  }
  const subscription = await lookup.findSubscription(subscriber);
  if (!subscription || subscription.subscriber_type !== subscriber.type) {
    throw billingFailure("SUBSCRIPTION_MISSING");
  }
  return { origin, caller, subscriber, subscription };
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function billingErrorResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  console.error("Subscription billing failed", error);
  return billingFailure("SERVER_ERROR");
}
