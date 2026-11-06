import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getActiveUserRole, getUser, supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { adminSetEnabledHandler, AUTH_BAN_DURATION } from "./handler.ts";

serve(withCors(adminSetEnabledHandler({
  getUser,
  getUserRole: getActiveUserRole,
  getTarget: async (userId) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("deleted_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("Profile could not be read");
    return data ? { deletedAt: data.deleted_at as string | null } : null;
  },
  setAuthBan: async (userId, banned) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? AUTH_BAN_DURATION : "none",
    });
    if (error) throw new Error("Auth ban could not be changed");
  },
  setProfileEnabled: async (userId, enabled) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ enabled })
      .eq("id", userId)
      .select("id")
      .single();
    if (error) throw new Error("Profile could not be updated");
  },
})));
