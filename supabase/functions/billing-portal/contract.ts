import {
  billingErrorResponse,
  billingFailure,
  type BillingLookup,
  readJsonObject,
  resolveBillingContext,
  subscriptionPagePath,
} from "../_shared/subscription-billing.ts";

export type BillingPortalParams = {
  customer: string;
  return_url: string;
  locale: "ro";
  configuration?: string;
};

export type BillingPortalDependencies = BillingLookup & {
  createPortalSession: (params: BillingPortalParams) => Promise<string | null>;
  portalConfiguration: string | null;
};

export function billingPortalHandler(dependencies: BillingPortalDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    try {
      const { origin, subscriber, subscription } = await resolveBillingContext(
        request,
        dependencies,
      );
      const body = await readJsonObject(request);
      if (!body || Object.keys(body).length) {
        return billingFailure("INVALID_REQUEST");
      }
      if (!subscription.stripe_customer_id) {
        return billingFailure("NO_BILLING_ACCOUNT");
      }
      const url = await dependencies.createPortalSession({
        customer: subscription.stripe_customer_id,
        return_url: `${origin}${subscriptionPagePath(subscriber.type)}`,
        locale: "ro",
        ...(dependencies.portalConfiguration
          ? { configuration: dependencies.portalConfiguration }
          : {}),
      });
      if (!url) return billingFailure("STRIPE_ERROR");
      return Response.json({ url });
    } catch (error) {
      return billingErrorResponse(error);
    }
  };
}
