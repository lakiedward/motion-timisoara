import { withCors } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { managedCoachHandler } from "./contract.ts";
import {
  createManagedCoachDependencies,
  type ManagedCoachClient,
} from "./dependencies.ts";

const client: ManagedCoachClient = {
  auth: supabaseAdmin.auth,
  from: (table) =>
    supabaseAdmin.from(table) as unknown as ReturnType<
      ManagedCoachClient["from"]
    >,
};

Deno.serve(
  withCors(managedCoachHandler(createManagedCoachDependencies(client))),
);
