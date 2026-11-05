import { assert, assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  adminExtendHandler,
  type AdminExtendServices,
  ExtensionRpcError,
  type ExtensionPlan,
  parseExtensionRequest,
} from "./handler.ts";

const SUBSCRIPTION_ID = "00000000-0000-4000-8000-0000000000f1";
const NEW_END = "2026-12-20T10:00:00.000Z";

function plan(overrides: Partial<ExtensionPlan> = {}): ExtensionPlan {
  return {
    status: "trialing",
    previousEnd: "2026-11-20T10:00:00.000Z",
    newEnd: NEW_END,
    stripeSubscriptionId: null,
    ...overrides,
  };
}

function setup(overrides: Partial<AdminExtendServices> = {}) {
  const calls = {
    begin: [] as unknown[][],
    status: [] as string[],
    stripe: [] as unknown[][],
    apply: [] as unknown[][],
  };
  const services: AdminExtendServices = {
    getUser: () => Promise.resolve({ id: "admin" }),
    getUserRole: () => Promise.resolve("ADMIN"),
    beginExtension: (...args) => {
      calls.begin.push(args);
      return Promise.resolve(plan());
    },
    stripeSubscriptionStatus: (id) => {
      calls.status.push(id);
      return Promise.resolve("trialing");
    },
    setStripeTrialEnd: (...args) => {
      calls.stripe.push(args);
      return Promise.resolve();
    },
    applyExtension: (...args) => {
      calls.apply.push(args);
      return Promise.resolve("adjustment-1");
    },
    ...overrides,
  };
  return { calls, handler: adminExtendHandler(services) };
}

function post(body: unknown) {
  return new Request("http://localhost/admin-extend-subscription", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID = { subscriptionId: SUBSCRIPTION_ID, days: 30, reason: "  Test cu proprietarul  " };

Deno.test("parseExtensionRequest validates the subscription, days and reason", () => {
  assertEquals(parseExtensionRequest(null), "Cererea nu este validă.");
  assertEquals(parseExtensionRequest({ ...VALID, subscriptionId: "x" }), "Abonamentul nu este valid.");
  assertEquals(parseExtensionRequest({ ...VALID, days: 0 }), "Alege între 1 și 366 de zile.");
  assertEquals(parseExtensionRequest({ ...VALID, days: 367 }), "Alege între 1 și 366 de zile.");
  assertEquals(parseExtensionRequest({ ...VALID, days: 1.5 }), "Alege între 1 și 366 de zile.");
  assertEquals(
    parseExtensionRequest({ ...VALID, reason: " a " }),
    "Motivul trebuie să aibă între 3 și 500 de caractere.",
  );
  assertEquals(parseExtensionRequest(VALID), {
    subscriptionId: SUBSCRIPTION_ID,
    days: 30,
    reason: "Test cu proprietarul",
  });
});

Deno.test("only a live ADMIN role may extend", async () => {
  const { calls, handler } = setup({ getUserRole: () => Promise.resolve("CLUB") });
  assertEquals((await handler(post(VALID))).status, 403);
  assertEquals(calls.begin.length, 0);
  assertEquals((await setup().handler(new Request("http://localhost", { method: "GET" }))).status, 405);
});

Deno.test("an extension without Stripe is stored with the computed end", async () => {
  const { calls, handler } = setup();
  const response = await handler(post(VALID));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { adjustmentId: "adjustment-1", newEnd: NEW_END, stripeUpdated: false });
  assertEquals(calls.begin, [[SUBSCRIPTION_ID, 30]]);
  assertEquals(calls.stripe.length, 0);
  assertEquals(calls.apply, [[
    { subscriptionId: SUBSCRIPTION_ID, days: 30, reason: "Test cu proprietarul" },
    "admin",
    NEW_END,
  ]]);
});

Deno.test("a live Stripe subscription gets the new trial end before the database changes", async () => {
  const order: string[] = [];
  const { calls, handler } = setup({
    beginExtension: () => Promise.resolve(plan({ stripeSubscriptionId: "sub_test1" })),
    setStripeTrialEnd: () => {
      order.push("stripe");
      return Promise.resolve();
    },
    applyExtension: () => {
      order.push("apply");
      return Promise.resolve("adjustment-1");
    },
  });
  const response = await handler(post(VALID));
  assertEquals((await response.json()).stripeUpdated, true);
  assertEquals(order, ["stripe", "apply"]);
  assertEquals(calls.begin.length, 1);
});

Deno.test("the Stripe trial end is the new end in whole seconds", async () => {
  const { calls, handler } = setup({
    beginExtension: () => Promise.resolve(plan({ stripeSubscriptionId: "sub_test1" })),
    setStripeTrialEnd: (...args) => {
      calls.stripe.push(args);
      return Promise.resolve();
    },
  });
  await handler(post(VALID));
  assertEquals(calls.stripe, [["sub_test1", Math.floor(Date.parse(NEW_END) / 1000)]]);
});

Deno.test("an ended Stripe subscription is not touched but the extension is stored", async () => {
  const { calls, handler } = setup({
    beginExtension: () => Promise.resolve(plan({ stripeSubscriptionId: "sub_test1" })),
    stripeSubscriptionStatus: () => Promise.resolve("canceled"),
  });
  const response = await handler(post(VALID));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).stripeUpdated, false);
  assertEquals(calls.stripe.length, 0);
  assertEquals(calls.apply.length, 1);
});

Deno.test("a Stripe failure changes nothing in the database", async () => {
  const { calls, handler } = setup({
    beginExtension: () => Promise.resolve(plan({ stripeSubscriptionId: "sub_test1" })),
    setStripeTrialEnd: () => Promise.reject(new Error("No such subscription")),
  });
  const response = await handler(post(VALID));
  assertEquals(response.status, 502);
  assert((await response.json()).error.includes("No such subscription"));
  assertEquals(calls.apply.length, 0);
});

Deno.test("database refusals keep their meaning", async () => {
  const cases: [string, string | undefined, number][] = [
    ["SUBSCRIPTION_NOT_FOUND", "P0002", 404],
    ["NO_END_DATE", "22023", 409],
    ["INVALID_DAYS", "22023", 400],
    ["boom", "XX000", 503],
  ];
  for (const [message, code, status] of cases) {
    const { calls, handler } = setup({
      beginExtension: () => Promise.reject(new ExtensionRpcError(message, code)),
    });
    assertEquals((await handler(post(VALID))).status, status, message);
    assertEquals(calls.apply.length, 0);
  }
});

Deno.test("a failed save after Stripe says Stripe already has the new date", async () => {
  const { handler } = setup({
    beginExtension: () => Promise.resolve(plan({ stripeSubscriptionId: "sub_test1" })),
    applyExtension: () => Promise.reject(new Error("db down")),
  });
  const response = await handler(post(VALID));
  assertEquals(response.status, 503);
  assert((await response.json()).error.includes("Stripe a primit data nouă"));
});
