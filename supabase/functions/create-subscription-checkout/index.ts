import { withCors } from "../_shared/cors.ts";
import { subscriptionCheckoutDependencies } from "../_shared/subscription-billing-dependencies.ts";
import { subscriptionCheckoutHandler } from "./contract.ts";

Deno.serve(
  withCors(subscriptionCheckoutHandler(subscriptionCheckoutDependencies())),
);
