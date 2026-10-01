import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getUser, supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import {
  coachInvitationDatabaseFailure,
  coachInvitationParameters,
  parseCoachInvitationResult,
} from "../_shared/coach-invitation.ts";
import { coachRedemptionHandler } from "./contract.ts";

serve(withCors(coachRedemptionHandler({
  getActor: getUser,
  redeem: async (userId, payload) => {
    const { data, error } = await supabaseAdmin.rpc(
      "redeem_coach_invitation",
      coachInvitationParameters(userId, payload),
    );
    if (error) return { error: coachInvitationDatabaseFailure(error) };
    const result = parseCoachInvitationResult(data);
    return result ? { data: result } : { error: "SERVER_ERROR" };
  },
})));
