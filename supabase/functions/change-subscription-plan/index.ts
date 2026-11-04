import { withCors } from "../_shared/cors.ts";
import { changePlanDependencies } from "../_shared/subscription-billing-dependencies.ts";
import { changePlanHandler } from "./contract.ts";

Deno.serve(withCors(changePlanHandler(changePlanDependencies())));
