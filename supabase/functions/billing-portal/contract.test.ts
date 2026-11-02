import { allowedBillingOrigin } from "../_shared/subscription-billing.ts";
import {
  assert,
  clubId,
  expectFailure,
  portalFixture,
  post,
  site,
} from "../create-subscription-checkout/test-fixtures.ts";

Deno.test("only the website origins with an explicit local port are accepted", () => {
  for (
    const origin of [
      "https://motionromania.ro",
      "https://www.motionromania.ro",
      "https://master--motiontimisoara.netlify.app",
      "https://deploy-preview-341--motiontimisoara.netlify.app",
      "http://localhost:3017",
      "http://127.0.0.1:4173",
    ]
  ) assert(allowedBillingOrigin(origin) === origin, origin);
  for (
    const origin of [
      null,
      "",
      "capacitor://localhost",
      "https://localhost",
      "http://localhost",
      "ionic://localhost",
      "http://motionromania.ro",
      "https://motionromania.ro.evil.test",
      "https://evilmotionromania.ro",
      "https://motiontimisoara.com",
      "https://deploy-preview-1--other.netlify.app",
      "https://feature--motiontimisoara.netlify.app",
    ]
  ) assert(allowedBillingOrigin(origin) === null, String(origin));
});

Deno.test("billing portal opens only for the caller's own Stripe customer", async () => {
  const club = portalFixture({
    role: "CLUB",
    subscription: { stripe_customer_id: "cus_club" },
    configuration: "bpc_1",
  });
  const response = await club.handler(
    post(undefined, "https://master--motiontimisoara.netlify.app"),
  );
  assert(
    response.status === 200 &&
      (await response.json()).url.startsWith("https://billing.stripe.com/"),
  );
  assert(club.calls.includes(`subscription:CLUB:${clubId}`));
  assert(
    club.portals[0].customer === "cus_club" &&
      club.portals[0].configuration === "bpc_1",
  );
  assert(
    club.portals[0].return_url ===
      "https://master--motiontimisoara.netlify.app/club/abonament",
  );

  const coach = portalFixture({
    subscription: { stripe_customer_id: "cus_coach" },
  });
  assert((await coach.handler(post({}))).status === 200);
  assert(
    coach.portals[0].return_url === `${site}/coach/abonament` &&
      coach.portals[0].configuration === undefined,
  );

  await expectFailure(
    await portalFixture({ subscription: { stripe_customer_id: "cus_coach" } })
      .handler(
        post({ subscriptionId: "00000000-0000-0000-0000-000000000099" }),
      ),
    400,
    "INVALID_REQUEST",
  );
  await expectFailure(
    await portalFixture().handler(post({})),
    409,
    "NO_BILLING_ACCOUNT",
  );
  await expectFailure(
    await portalFixture({ role: "PARENT" }).handler(post({})),
    403,
    "ROLE_NOT_ALLOWED",
  );
  await expectFailure(
    await portalFixture().handler(post({}, site, null)),
    401,
    "UNAUTHORIZED",
  );
  const native = portalFixture({
    subscription: { stripe_customer_id: "cus_coach" },
  });
  await expectFailure(
    await native.handler(post({}, "capacitor://localhost")),
    403,
    "ORIGIN_NOT_ALLOWED",
  );
  assert(native.calls.length === 0 && native.portals.length === 0);
});
