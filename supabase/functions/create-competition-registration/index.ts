import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { getUser, getUserRole, supabaseAdmin } from "../_shared/supabase.ts";
import { createCompetitionRegistrationHandler } from "./handler.ts";

serve(
  withCors(
    createCompetitionRegistrationHandler({
      db: supabaseAdmin,
      getUser,
      getUserRole,
    }),
  ),
);
