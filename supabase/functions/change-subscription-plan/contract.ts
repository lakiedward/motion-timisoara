import {
  billingErrorResponse,
  billingFailure,
  type BillingLookup,
  readJsonObject,
  resolveBillingContext,
  type SubscriberType,
} from "../_shared/subscription-billing.ts";

export type ChangePlan = {
  code: string;
  subscriber_type: SubscriberType;
  price_bani: number;
  coach_limit: number | null;
  stripe_price_id: string | null;
  active: boolean;
};

export type StripeSubscriptionSnapshot = {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  itemId: string;
  priceId: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  trialEnd: number | null;
  scheduleId: string | null;
  metadata: Record<string, string>;
};

export type UpgradeParams = {
  subscriptionId: string;
  itemId: string;
  priceId: string;
  planCode: string;
};

export type DowngradeParams = {
  subscriptionId: string;
  scheduleId: string | null;
  currentPriceId: string;
  currentPlanCode: string;
  priceId: string;
  planCode: string;
  periodStart: number;
  periodEnd: number;
  trialEnd: number | null;
  metadata: Record<string, string>;
};

export type LocalPlanPatch = {
  plan_code?: string;
  scheduled_plan_code: string | null;
};

export type ChangePlanDependencies = BillingLookup & {
  findClubPlans: () => Promise<ChangePlan[]>;
  countClubCoaches: (clubId: string) => Promise<number>;
  retrieveSubscription: (id: string) => Promise<StripeSubscriptionSnapshot>;
  releaseSchedule: (scheduleId: string) => Promise<void>;
  upgradeSubscription: (params: UpgradeParams) => Promise<void>;
  scheduleDowngrade: (params: DowngradeParams) => Promise<void>;
  saveLocalPlan: (rowId: string, patch: LocalPlanPatch) => Promise<void>;
};

const planCodePattern = /^[A-Z][A-Z_]{1,31}$/;
const CHANGEABLE = new Set(["active", "trialing"]);

export function parseChangeRequest(
  value: Record<string, unknown> | null,
): { planCode: string } | null {
  if (!value || Object.keys(value).some((key) => key !== "planCode")) {
    return null;
  }
  if (typeof value.planCode !== "string") return null;
  const planCode = value.planCode.trim();
  return planCodePattern.test(planCode) ? { planCode } : null;
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

export function changePlanHandler(dependencies: ChangePlanDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    try {
      const { subscriber, subscription } = await resolveBillingContext(
        request,
        dependencies,
      );
      const payload = parseChangeRequest(await readJsonObject(request));
      if (!payload) return billingFailure("INVALID_REQUEST");
      if (subscriber.type !== "CLUB") {
        return billingFailure("PLAN_CHANGE_CLUB_ONLY");
      }
      if (
        !subscription.stripe_subscription_id ||
        subscription.status === "expired"
      ) {
        return billingFailure("NO_BILLING_ACCOUNT");
      }

      const plans = await dependencies.findClubPlans();
      const target = plans.find((plan) => plan.code === payload.planCode);
      if (!target || !target.active || target.subscriber_type !== "CLUB") {
        return billingFailure("PLAN_NOT_FOUND");
      }
      if (!target.stripe_price_id) return billingFailure("PLAN_NOT_READY");

      const stripe = await dependencies.retrieveSubscription(
        subscription.stripe_subscription_id,
      );
      if (stripe.status === "past_due") {
        return billingFailure("SUBSCRIPTION_PAST_DUE");
      }
      if (!CHANGEABLE.has(stripe.status)) {
        return billingFailure("NO_BILLING_ACCOUNT");
      }
      if (stripe.cancelAtPeriodEnd) {
        return billingFailure("SUBSCRIPTION_CANCELED");
      }
      const current = plans.find((plan) =>
        plan.stripe_price_id === stripe.priceId
      );
      if (!current) {
        throw new Error(`No plan for Stripe price ${stripe.priceId}`);
      }

      if (target.code === current.code) {
        if (stripe.scheduleId) {
          await dependencies.releaseSchedule(stripe.scheduleId);
        }
        await dependencies.saveLocalPlan(subscription.id, {
          scheduled_plan_code: null,
        });
        return Response.json({
          result: "kept",
          planCode: current.code,
          effectiveAt: null,
        });
      }

      if (target.coach_limit !== null) {
        const coachCount = await dependencies.countClubCoaches(subscriber.id);
        if (coachCount > target.coach_limit) {
          return billingFailure("PLAN_BELOW_COACH_COUNT", {
            coachCount,
            coachLimit: target.coach_limit,
            coachesToRemove: coachCount - target.coach_limit,
          });
        }
      }

      if (target.price_bani > current.price_bani) {
        if (stripe.scheduleId) {
          await dependencies.releaseSchedule(stripe.scheduleId);
        }
        await dependencies.upgradeSubscription({
          subscriptionId: stripe.id,
          itemId: stripe.itemId,
          priceId: target.stripe_price_id,
          planCode: target.code,
        });
        await dependencies.saveLocalPlan(subscription.id, {
          plan_code: target.code,
          scheduled_plan_code: null,
        });
        return Response.json({
          result: "upgraded",
          planCode: target.code,
          effectiveAt: null,
        });
      }

      await dependencies.scheduleDowngrade({
        subscriptionId: stripe.id,
        scheduleId: stripe.scheduleId,
        currentPriceId: stripe.priceId,
        currentPlanCode: current.code,
        priceId: target.stripe_price_id,
        planCode: target.code,
        periodStart: stripe.currentPeriodStart,
        periodEnd: stripe.currentPeriodEnd,
        trialEnd: stripe.status === "trialing" ? stripe.trialEnd : null,
        metadata: stripe.metadata,
      });
      await dependencies.saveLocalPlan(subscription.id, {
        scheduled_plan_code: target.code,
      });
      return Response.json({
        result: "scheduled",
        planCode: target.code,
        effectiveAt: iso(stripe.currentPeriodEnd),
      });
    } catch (error) {
      return billingErrorResponse(error);
    }
  };
}
