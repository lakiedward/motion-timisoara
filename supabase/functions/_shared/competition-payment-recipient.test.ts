import { competitionPaymentRecipient } from "./competition-payment-recipient.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
}

function database(
  competition: Record<string, unknown>,
  recipient?: Record<string, unknown>,
) {
  const tables: string[] = [];
  const db = {
    from(table: string) {
      tables.push(table);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: () =>
          Promise.resolve({
            data: table === "competitions" ? competition : (recipient ?? null),
            error: null,
          }),
      };
    },
  } as unknown as Parameters<typeof competitionPaymentRecipient>[0];
  return { db, tables };
}

async function rejected(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof Response && error.status === 409) return;
    throw error;
  }
  throw new Error("Expected conflict");
}

Deno.test(
  "competition card charges route to the club owner without coach fallback",
  async () => {
    const context = database(
      { club_id: "club", coach_id: null },
      {
        stripe_account_id: "acct_club",
        stripe_onboarding_complete: true,
        stripe_charges_enabled: true,
        stripe_payouts_enabled: true,
      },
    );
    equal(await competitionPaymentRecipient(context.db, "competition"), {
      accountId: "acct_club",
      type: "CLUB",
      coachId: null,
      clubId: "club",
    });
    equal(context.tables, ["competitions", "clubs"]);
  },
);

Deno.test("competition card charges route to the coach owner", async () => {
  const context = database(
    { club_id: null, coach_id: "coach" },
    {
      stripe_account_id: "acct_coach",
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
    },
  );
  equal(await competitionPaymentRecipient(context.db, "competition"), {
    accountId: "acct_coach",
    type: "COACH",
    coachId: "coach",
    clubId: null,
  });
  equal(context.tables, ["competitions", "coach_profiles"]);
});

Deno.test(
  "admin-owned competition charges use the platform account",
  async () => {
    const context = database({ club_id: null, coach_id: null });
    equal(await competitionPaymentRecipient(context.db, "competition"), {
      accountId: null,
      type: "PLATFORM",
      coachId: null,
      clubId: null,
    });
    equal(context.tables, ["competitions"]);
  },
);

Deno.test(
  "competition card payment refuses an unready or ambiguous recipient",
  async () => {
    const incomplete = database(
      { club_id: "club", coach_id: null },
      {
        stripe_account_id: "acct_club",
        stripe_onboarding_complete: true,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: true,
      },
    );
    await rejected(() => competitionPaymentRecipient(incomplete.db, "competition"));
    await rejected(() =>
      competitionPaymentRecipient(
        database({ club_id: "club", coach_id: "coach" }).db,
        "competition",
      )
    );
  },
);
