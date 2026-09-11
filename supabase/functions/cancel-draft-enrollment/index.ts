import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { cancelDraftHandler } from "./handler.ts";

serve(withCors(cancelDraftHandler({ db: supabaseAdmin, getUser })));
