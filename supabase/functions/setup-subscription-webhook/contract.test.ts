import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { stripeModeFromKey } from "../sync-subscription-prices/sync.ts";
import {
  createSetupHandler,
  PAYMENT_EVENTS,
  SUBSCRIPTION_EVENTS,
  WEBHOOK_TARGETS,
  type WebhookEndpoint,
} from "./handler.ts";

const BASE = "https://ref.supabase.co/functions/v1";
const URL = `${BASE}/stripe-subscription-webhook`;

type SetupOptions = {
  admin?: boolean;
  key?: string;
  existing?: WebhookEndpoint[];
  listed?: (endpoint: WebhookEndpoint) => WebhookEndpoint | null;
  secret?: string;
};

function setup(options: SetupOptions = {}) {
  const endpoints = [...(options.existing ?? [])];
  const removed: string[] = [];
  const listCalls: string[] = [];
  const created: { url: string; events: string[]; description: string; connect: boolean }[] = [];
  const handler = createSetupHandler({
    stripeKey: options.key ?? "sk_test_123",
    modeFromKey: stripeModeFromKey,
    requireAdmin: () => Promise.resolve(options.admin ?? true),
    functionsBaseUrl: BASE,
    endpoints: () => ({
      list: () => {
        listCalls.push("list");
        const shown = endpoints.map((endpoint) => (options.listed ? options.listed(endpoint) : endpoint));
        return Promise.resolve(shown.filter((endpoint): endpoint is WebhookEndpoint => endpoint !== null));
      },
      create: (input) => {
        created.push(input);
        const endpoint = {
          id: `we_${created.length}`,
          url: input.url,
          status: "enabled",
          enabled_events: [...input.events],
          secret: options.secret ?? "whsec_new",
        };
        endpoints.push(endpoint);
        return Promise.resolve(endpoint);
      },
      remove: (id) => {
        removed.push(id);
        endpoints.splice(endpoints.findIndex((endpoint) => endpoint.id === id), 1);
        return Promise.resolve();
      },
    }),
  });
  const call = (body: unknown = {}) =>
    handler(new Request("http://local/setup-subscription-webhook", { method: "POST", body: JSON.stringify(body) }));
  const plan = (query = "") => handler(new Request(`http://local/setup-subscription-webhook${query}`));
  return { handler, call, plan, removed, created, endpoints, listCalls };
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
});

Deno.test("replace creates and verifies the new endpoint first and leaves the old one for the caller to remove", async () => {
  const s = setup({ existing: [{ id: "we_old", url: URL }, { id: "we_other", url: "https://other" }] });
  const replaced = await s.call({ replace: true });
  assertEquals(replaced.status, 200);
  const body = await replaced.json();
  assertEquals(s.removed, []);
  assertEquals(body.pending_removal, ["we_old"]);
  assertEquals(body.endpoint_id, "we_1");
  assertEquals(body.secret, "whsec_new");
  assertEquals(s.endpoints.map((endpoint) => endpoint.id), ["we_old", "we_other", "we_1"]);
  assertEquals(s.listCalls.length, 2);
});

Deno.test("a new endpoint that fails verification is deleted and the old one is kept", async () => {
  const cases: SetupOptions[] = [
    { listed: (endpoint) => (endpoint.id === "we_1" ? null : endpoint) },
    { listed: (endpoint) => (endpoint.id === "we_1" ? { ...endpoint, status: "disabled" } : endpoint) },
    { listed: (endpoint) => (endpoint.id === "we_1" ? { ...endpoint, enabled_events: ["invoice.paid"] } : endpoint) },
    { secret: "" },
  ];
  for (const options of cases) {
    const s = setup({ ...options, existing: [{ id: "we_old", url: URL }] });
    const response = await s.call({ replace: true });
    assertEquals(response.status, 502);
    const body = await response.json();
    assertEquals(body.secret, undefined);
    assertEquals([body.removed_new, body.kept], ["we_1", ["we_old"]]);
    assertEquals(s.removed, ["we_1"]);
    assertEquals(s.endpoints.map((endpoint) => endpoint.id), ["we_old"]);
  }
});

Deno.test("GET is a dry run that plans create, secret and delete without writing", async () => {
  const s = setup({
    key: "sk_live_1",
    existing: [{ id: "we_old", url: URL, status: "enabled", enabled_events: ["invoice.paid"] }],
  });
  const blocked = await (await s.plan("?kind=subscriptions")).json();
  assertEquals([blocked.dry_run, blocked.mode, blocked.blocked, blocked.planned_writes], [true, "live", true, []]);
  assertEquals(blocked.existing[0].events_match, false);
  const response = await s.plan("?kind=subscriptions&replace=true");
  assertEquals(response.status, 200);
  const plan = await response.json();
  assertEquals(plan.blocked, false);
  assertEquals(plan.planned_writes.map((w: { operation: string; id: string }) => `${w.operation}:${w.id}`), [
    "webhook_endpoints.create:(endpoint nou)",
    "secrets.set:STRIPE_SUBSCRIPTION_WEBHOOK_SECRET",
    "webhook_endpoints.delete:we_old",
  ]);
  assertEquals(JSON.stringify(plan).includes("whsec"), false);
  const removal = await (await s.plan("?action=remove&remove=we_old,we_gone")).json();
  assertEquals(removal.would_remove.map((endpoint: { id: string }) => endpoint.id), ["we_old"]);
  assertEquals(removal.missing, ["we_gone"]);
  assertEquals((await s.plan("?kind=refunds")).status, 400);
  assertEquals((await s.plan("?action=remove&remove=bad")).status, 400);
  assertEquals((await s.plan("?action=drop")).status, 400);
  assertEquals(s.created.length + s.removed.length, 0);
  assertEquals(s.endpoints.length, 1);
});

Deno.test("GET dry run is admin only and other methods are refused", async () => {
  const s = setup({ admin: false });
  assertEquals((await s.plan()).status, 403);
  assertEquals(s.listCalls.length, 0);
  const other = setup();
  for (const method of ["PUT", "DELETE", "PATCH"]) {
    assertEquals((await other.handler(new Request("http://local/x", { method }))).status, 405);
  }
  assertEquals(other.listCalls.length + other.created.length + other.removed.length, 0);
});

Deno.test("payments and connect endpoints target their own functions, events and secrets", async () => {
  const s = setup();
  const payments = await (await s.call({ kind: "payments" })).json();
  assertEquals(payments.url, `${BASE}/stripe-webhook`);
  assertEquals(payments.events, PAYMENT_EVENTS);
  assertEquals(PAYMENT_EVENTS.includes("payment_intent.succeeded"), true);
  assertEquals(PAYMENT_EVENTS.includes("payment_intent.payment_failed"), true);
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
