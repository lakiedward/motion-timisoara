import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { getUser, getUserRole, supabaseAdmin } from "../_shared/supabase.ts";
import { validateCompetitionRegistrationHandler } from "./handler.ts";

serve(
  withCors(
    validateCompetitionRegistrationHandler({
      db: supabaseAdmin,
      getUser,
      getUserRole,
    }),
  ),
);
