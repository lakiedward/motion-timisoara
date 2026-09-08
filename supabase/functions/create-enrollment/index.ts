import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser, getUserRole } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { createEnrollmentHandler } from "./handler.ts";

serve(withCors(createEnrollmentHandler({ db: supabaseAdmin, getUser, getUserRole })));
