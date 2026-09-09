import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getUser, supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { locationHandler } from "./contract.ts";

serve(withCors(locationHandler({
  getActor: getUser,
  transact: async (actorId, payload) => {
    const { data, error } = await supabaseAdmin.rpc(
      "coach_live_location_transaction",
      {
        p_actor_id: actorId,
        p_payload: payload,
      },
    );
    if (error || !data || typeof data.success !== "boolean") {
      throw new Error("Location transaction failed");
    }
    return data;
  },
})));
