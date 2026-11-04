import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { stripeModeFromKey } from "../sync-subscription-prices/sync.ts";
import { createSetupHandler, SUBSCRIPTION_EVENTS, WEBHOOK_TARGETS, type WebhookEndpoint } from "./handler.ts";

const BASE = "https://ref.supabase.co/functions/v1";
const URL = `${BASE}/stripe-subscription-webhook`;

function setup(options: { admin?: boolean; key?: string; existing?: WebhookEndpoint[] } = {}) {
  const endpoints = [...(options.existing ?? [])];
  const removed: string[] = [];
  const created: { url: string; events: string[]; description: string; connect: boolean }[] = [];
  const handler = createSetupHandler({
    stripeKey: options.key ?? "sk_test_123",
    modeFromKey: stripeModeFromKey,
    requireAdmin: () => Promise.resolve(options.admin ?? true),
    functionsBaseUrl: BASE,
    endpoints: () => ({
      list: () => Promise.resolve([...endpoints]),
      create: (input) => {
        created.push(input);
        const endpoint = { id: `we_${created.length}`, url: input.url, secret: "whsec_new" };
        endpoints.push(endpoint);
        return Promise.resolve(endpoint);
      },
      remove: (id) => {
        removed.push(id);
        return Promise.resolve();
      },
    }),
  });
  const call = (body: unknown = {}) =>
    handler(new Request("http://local/setup-subscription-webhook", { method: "POST", body: JSON.stringify(body) }));
  return { call, removed, created };
}

Deno.test("only an admin can configure the endpoint", async () => {
  const s = setup({ admin: false });
  assertEquals((await s.call()).status, 403);
  assertEquals(s.created.length, 0);
});

Deno.test("creates the TEST endpoint with the six subscription events and returns its secret once", async () => {
  const s = setup();
  const response = await s.call();
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.mode, "test");
  assertEquals(body.url, URL);
  assertEquals(body.secret, "whsec_new");
  assertEquals(body.secret_name, "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");
  assertEquals(s.created, [{
    url: URL,
    events: SUBSCRIPTION_EVENTS,
    description: "Motion România: abonamente antrenori și cluburi",
    connect: false,
  }]);
  assertEquals([...SUBSCRIPTION_EVENTS].sort(), [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.deleted",
    "customer.subscription.updated",
    "invoice.paid",
    "invoice.payment_failed",
  ]);
});

Deno.test("an existing endpoint is not duplicated unless replace is requested", async () => {
  const s = setup({ existing: [{ id: "we_old", url: URL }, { id: "we_other", url: "https://other" }] });
  const refused = await s.call();
  assertEquals(refused.status, 409);
  assertEquals((await refused.json()).secret, undefined);
  assertEquals(s.created.length, 0);
  const replaced = await s.call({ replace: true });
  assertEquals(replaced.status, 200);
  assertEquals(s.removed, ["we_old"]);
  assertEquals((await replaced.json()).replaced, ["we_old"]);
});

Deno.test("live keys need confirmLive and test keys refuse it", async () => {
  assertEquals((await setup({ key: "sk_live_1" }).call()).status, 409);
  assertEquals((await setup({ key: "sk_live_1" }).call({ confirmLive: true })).status, 200);
  assertEquals((await setup().call({ confirmLive: true })).status, 409);
  assertEquals((await setup({ key: "pk_test_1" }).call()).status, 503);
});

Deno.test("payments and connect endpoints target their own functions, events and secrets", async () => {
  const s = setup();
  const payments = await (await s.call({ kind: "payments" })).json();
  assertEquals(payments.url, `${BASE}/stripe-webhook`);
  assertEquals(payments.events, ["payment_intent.succeeded", "payment_intent.payment_failed"]);
  assertEquals(payments.secret_name, "STRIPE_WEBHOOK_SECRET");
  assertEquals(payments.connect, false);
  const connect = await (await s.call({ kind: "connect" })).json();
  assertEquals(connect.url, `${BASE}/stripe-connect-webhook`);
  assertEquals(connect.events, ["account.updated"]);
  assertEquals(connect.secret_name, "STRIPE_CONNECT_WEBHOOK_SECRET");
  assertEquals(s.created[1].connect, true);
  assertEquals((await s.call({ kind: "refunds" })).status, 400);
  assertEquals(Object.keys(WEBHOOK_TARGETS).sort(), ["connect", "payments", "subscriptions"]);
});

Deno.test("list is read-only, labels known endpoints and never returns secrets", async () => {
  const s = setup({
    key: "sk_live_1",
    existing: [
      { id: "we_rail", url: "https://old.up.railway.app/api/webhooks/stripe", status: "enabled", enabled_events: ["*"] },
      { id: "we_pay", url: `${BASE}/stripe-webhook`, status: "enabled", enabled_events: ["payment_intent.succeeded"] },
    ],
  });
  const response = await s.call({ action: "list" });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.mode, "live");
  assertEquals(body.endpoints.map((endpoint: { kind: string | null }) => endpoint.kind), [null, "payments"]);
  assertEquals(JSON.stringify(body).includes("whsec"), false);
  assertEquals(s.created.length + s.removed.length, 0);
});

Deno.test("remove deletes only listed existing endpoints and needs confirmLive on live keys", async () => {
  const existing = [{ id: "we_dead", url: "https://api.motiontimisoara.com/webhook" }, { id: "we_keep", url: URL }];
  assertEquals((await setup({ existing }).call({ action: "remove", remove: [] })).status, 400);
  assertEquals((await setup({ existing }).call({ action: "remove", remove: ["we_missing"] })).status, 404);
  const live = setup({ key: "sk_live_1", existing });
  assertEquals((await live.call({ action: "remove", remove: ["we_dead"] })).status, 409);
  const confirmed = await live.call({ action: "remove", remove: ["we_dead"], confirmLive: true });
  assertEquals(confirmed.status, 200);
  assertEquals(live.removed, ["we_dead"]);
  assertEquals((await setup().call({ action: "drop" })).status, 400);
});
