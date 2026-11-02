import { withCors } from "../_shared/cors.ts";
import { billingPortalDependencies } from "../_shared/subscription-billing-dependencies.ts";
import { billingPortalHandler } from "./contract.ts";

Deno.serve(withCors(billingPortalHandler(billingPortalDependencies())));
