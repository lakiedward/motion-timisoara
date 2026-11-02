import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { stripeModeFromKey } from "../sync-subscription-prices/sync.ts";
import { createSetupHandler, SUBSCRIPTION_EVENTS, type WebhookEndpoint } from "./handler.ts";

const URL = "https://ref.supabase.co/functions/v1/stripe-subscription-webhook";

function setup(options: { admin?: boolean; key?: string; existing?: WebhookEndpoint[] } = {}) {
  const endpoints = [...(options.existing ?? [])];
  const removed: string[] = [];
  const created: { url: string; events: string[]; description: string }[] = [];
  const handler = createSetupHandler({
    stripeKey: options.key ?? "sk_test_123",
    modeFromKey: stripeModeFromKey,
    requireAdmin: () => Promise.resolve(options.admin ?? true),
    webhookUrl: URL,
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
  assertEquals(s.created, [{ url: URL, events: SUBSCRIPTION_EVENTS, description: "Motion România: abonamente antrenori și cluburi" }]);
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
