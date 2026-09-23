import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyPaymentResult } from "./payment-completion.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
}

function fixture(enrollment: Record<string, unknown>) {
  const sent: { channel: string; event: string; payload: unknown }[] = [];
  const db = {
    from(table: string) {
      if (table !== "enrollments") throw new Error("Unexpected table");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: () => Promise.resolve({ data: enrollment, error: null }),
      };
    },
    channel(channel: string) {
      return {
        send: ({ event, payload }: { event: string; payload: unknown }) => {
          sent.push({ channel, event, payload });
          return Promise.resolve();
        },
      };
    },
    removeChannel: () => Promise.resolve(),
  } as unknown as SupabaseClient;
  return { db, sent };
}

Deno.test("adult competition payment notifies only its own profile channel", async () => {
  const { db, sent } = fixture({
    id: "enrollment",
    entity_id: "competition",
    child_id: null,
    adult_profile_id: "adult",
    child: null,
  });
  await notifyPaymentResult(db, {
    changed: true,
    status: "SUCCEEDED",
    enrollmentId: "enrollment",
    sessionsAdded: 0,
  });
  equal(sent, [{
    channel: "user:adult:payments",
    event: "enrollment_ready",
    payload: { enrollmentId: "enrollment", status: "ACTIVE" },
  }]);
});

Deno.test("child payment retains parent channel and never broadcasts to an adult id", async () => {
  const { db, sent } = fixture({
    id: "enrollment",
    entity_id: "competition",
    child_id: "child",
    adult_profile_id: "unrelated",
    child: { parent_id: "parent" },
  });
  await notifyPaymentResult(db, {
    changed: true,
    status: "FAILED",
    enrollmentId: "enrollment",
    sessionsAdded: 0,
  }, "Plata a eșuat");
  equal(sent, [{
    channel: "user:parent:payments",
    event: "payment_failed",
    payload: { enrollmentId: "enrollment", reason: "Plata a eșuat" },
  }]);
});
