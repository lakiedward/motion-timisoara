import { type PushClaim, pushDispatcher } from "./contract.ts";
import { firebaseMessaging } from "./firebase.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const rpc = async (name: string, body: Record<string, unknown> = {}) => {
  if (!url || !serviceKey) {
    throw new Error("Database configuration unavailable");
  }
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Push database operation unavailable");
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
const identity = (claim: PushClaim) => ({
  p_delivery_id: claim.deliveryId,
  p_lease_id: claim.leaseId,
});
const firebase = firebaseMessaging(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON"));

Deno.serve(pushDispatcher({
  secret: Deno.env.get("PUSH_DISPATCH_SECRET"),
  authorize: firebase.authorize,
  claim: () => rpc("claim_push_deliveries", { p_limit: 8 }),
  prepare: (claim) => rpc("prepare_push_delivery", identity(claim)),
  finish: async (claim, outcome) => {
    await rpc("finish_push_delivery", {
      ...identity(claim),
      p_outcome: outcome.outcome,
      p_code: outcome.code,
      p_retry_after: outcome.retryAfter ?? 0,
    });
  },
  send: firebase.send,
}));
