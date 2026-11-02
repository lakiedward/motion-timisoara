import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  type CompanyLookup,
  isValidCui,
  lookupAnafCompany,
  normalizeCui,
  parseAnafCompany,
} from "./_shared/company-cui.ts";
import {
  type ClubRecord,
  parseRegisterClub,
  type RegisterClubDependencies,
  registerClubHandler,
} from "./register-club/contract.ts";

const sportId = "00000000-0000-0000-0000-000000000003";
const request = {
  email: " club@local.test ",
  password: "local-test-only",
  name: " Admin Club ",
  phone: "0712 345 678",
  clubName: " Club Test ",
  companyCui: "RO 49252540",
  clubCity: " Timișoara ",
  sportIds: [sportId, sportId],
};

const anafFound = {
  found: [{
    date_generale: {
      cui: 49252540,
      denumire: "TITUS CLUB SWIM&FUN S.R.L.",
      adresa: "JUD. TIMIŞ, SAT GHIRODA COM. GHIRODA, STR. ARIEŞ, NR.2",
      nrRegCom: "J2023004752357",
      stare_inregistrare: "INREGISTRAT din data 08.12.2023",
    },
    stare_inactiv: { dataRadiere: "", statusInactivi: false },
  }],
  notFound: [],
};

Deno.test("CUI control digit and RO prefix", () => {
  assertEquals(normalizeCui(" ro 4925 2540 "), "49252540");
  assertEquals(isValidCui("RO49252540"), true);
  assertEquals(isValidCui("49252541"), false);
  assertEquals(isValidCui("0123"), false);
  assertEquals(isValidCui("abc"), false);
});

Deno.test("ANAF answer maps to found, missing, deregistered and inactive", () => {
  assertEquals(parseAnafCompany("49252540", anafFound), {
    status: "found",
    company: {
      cui: "49252540",
      name: "TITUS CLUB SWIM&FUN S.R.L.",
      address: "JUD. TIMIŞ, SAT GHIRODA COM. GHIRODA, STR. ARIEŞ, NR.2",
      regNumber: "J2023004752357",
    },
  });
  assertEquals(
    parseAnafCompany("49252540", { found: [], notFound: [49252540] }),
    { status: "not_found" },
  );
  const entry = anafFound.found[0];
  assertEquals(
    parseAnafCompany("49252540", {
      found: [{
        ...entry,
        stare_inactiv: { dataRadiere: "2025-01-01", statusInactivi: true },
      }],
    }),
    { status: "deregistered" },
  );
  assertEquals(
    parseAnafCompany("49252540", {
      found: [{
        ...entry,
        stare_inactiv: { dataRadiere: "", statusInactivi: true },
      }],
    }),
    { status: "inactive" },
  );
  assertEquals(parseAnafCompany("49252540", "<html>"), {
    status: "unavailable",
  });
});

Deno.test("ANAF outage is unavailable, not a refusal", async () => {
  const down = () => Promise.reject(new Error("timeout"));
  assertEquals(await lookupAnafCompany("49252540", down as typeof fetch), {
    status: "unavailable",
  });
  const error = () => Promise.resolve(new Response("busy", { status: 503 }));
  assertEquals(await lookupAnafCompany("49252540", error as typeof fetch), {
    status: "unavailable",
  });
});

Deno.test("ANAF request sends the numeric CUI and today's date", async () => {
  let sent: unknown;
  const fetcher = (_url: string, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return Promise.resolve(Response.json(anafFound));
  };
  const result = await lookupAnafCompany(
    "RO49252540",
    fetcher as typeof fetch,
    new Date("2026-11-02T12:00:00Z"),
  );
  assertEquals(sent, [{ cui: 49252540, data: "2026-11-02" }]);
  assertEquals(result.status, "found");
});

Deno.test("parse requires name, CUI, email and phone", () => {
  assertEquals(parseRegisterClub(request), {
    email: "club@local.test",
    password: "local-test-only",
    name: "Admin Club",
    phone: "0712345678",
    clubName: "Club Test",
    companyCui: "49252540",
    clubCity: "Timișoara",
    sportIds: [sportId],
  });
  for (const key of ["companyCui", "phone", "email", "clubName"]) {
    assertEquals(parseRegisterClub({ ...request, [key]: undefined }), null);
  }
  assertEquals(parseRegisterClub({ ...request, companyCui: "49252541" }), null);
  assertEquals(parseRegisterClub({ ...request, clubCity: undefined })?.clubCity, null);
});

function harness(lookup: CompanyLookup) {
  const calls: string[] = [];
  let inserted: ClubRecord | undefined;
  const dependencies: RegisterClubDependencies = {
    lookupCompany: () => Promise.resolve(lookup),
    createUser: () => {
      calls.push("createUser");
      return Promise.resolve({ id: "user-1" });
    },
    promoteToClub: () => {
      calls.push("promote");
      return Promise.resolve(true);
    },
    insertClub: (record) => {
      calls.push("insertClub");
      inserted = record;
      return Promise.resolve("club-1");
    },
    linkSports: () => {
      calls.push("linkSports");
      return Promise.resolve();
    },
    deleteCreatedUser: () => {
      calls.push("delete");
      return Promise.resolve();
    },
    createStripeAccount: () => Promise.reject(new Error("stripe down")),
  };
  return { calls, dependencies, inserted: () => inserted };
}

function post(body: unknown) {
  return new Request("http://local.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

Deno.test("a verified company is stored with the ANAF data", async () => {
  const found = parseAnafCompany("49252540", anafFound);
  const h = harness(found);
  const response = await registerClubHandler(h.dependencies)(post(request));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    userId: "user-1",
    clubId: "club-1",
    stripeAccountId: null,
    companyVerified: true,
  });
  assertEquals(h.inserted()?.company?.name, "TITUS CLUB SWIM&FUN S.R.L.");
  assertEquals(h.calls, ["createUser", "promote", "insertClub", "linkSports"]);
});

Deno.test("an unknown, deregistered or inactive CUI creates nothing", async () => {
  for (
    const [status, code] of [
      ["not_found", "CUI_NOT_FOUND"],
      ["deregistered", "CUI_DEREGISTERED"],
      ["inactive", "CUI_INACTIVE"],
    ] as const
  ) {
    const h = harness({ status });
    const response = await registerClubHandler(h.dependencies)(post(request));
    assertEquals(response.status, 422);
    assertEquals((await response.json()).code, code);
    assertEquals(h.calls, []);
  }
});

Deno.test("ANAF outage still registers the club as unverified", async () => {
  const h = harness({ status: "unavailable" });
  const response = await registerClubHandler(h.dependencies)(post(request));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).companyVerified, false);
  assertEquals(h.inserted()?.company, null);
  assertEquals(h.inserted()?.payload.companyCui, "49252540");
});

Deno.test("a failed club insert removes the new account", async () => {
  const h = harness({ status: "unavailable" });
  h.dependencies.insertClub = () => Promise.resolve(null);
  const response = await registerClubHandler(h.dependencies)(post(request));
  assertEquals(response.status, 500);
  assertEquals(h.calls.at(-1), "delete");
});

Deno.test("an invalid body is refused before ANAF or auth", async () => {
  const h = harness({ status: "unavailable" });
  const response = await registerClubHandler(h.dependencies)(
    post({ ...request, phone: "" }),
  );
  assertEquals(response.status, 400);
  assertEquals(h.calls, []);
});
