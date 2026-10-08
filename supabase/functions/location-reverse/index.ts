import { withCors } from "../_shared/cors.ts";
import { getUser, supabaseAdmin } from "../_shared/supabase.ts";
import { createLocationReverseHandler } from "./handler.ts";
import { lookupAddress } from "./provider.ts";

const endpoint = Deno.env.get("LOCATION_REVERSE_URL") ??
  "https://photon.koalasec.org/reverse";

Deno.serve(withCors(createLocationReverseHandler({
  enabled: Boolean(endpoint) && endpoint !== "off",
  getCaller: async (req) => {
    const user = await getUser(req);
    const { data, error } = await supabaseAdmin.from("profiles")
      .select("role,enabled").eq("id", user.id).maybeSingle();
    if (error) throw new Error("Caller profile unavailable");
    return data;
  },
  claim: async (key) => {
    const { data, error } = await supabaseAdmin.rpc("claim_location_reverse", {
      p_key: key,
    });
    if (error || !data) throw new Error("Lookup cache unavailable");
    return data;
  },
  lookup: (lat, lng) => lookupAddress(endpoint, lat, lng),
  finish: async (token, key, result) => {
    const { error } = await supabaseAdmin.rpc("finish_location_reverse", {
      p_token: token,
      p_key: key,
      p_result: result,
    });
    if (error) throw new Error("Lookup completion unavailable");
  },
})));
