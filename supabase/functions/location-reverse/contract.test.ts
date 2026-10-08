import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { createLocationReverseHandler } from "./handler.ts";
import { lookupAddress, parseAddress } from "./provider.ts";

const address = {
  address: "Strada Vasile Goldiș 8",
  city: "Timișoara",
  county: "Timiș",
};
const request = (body: unknown = { lat: 45.756903, lng: 21.235401 }) =>
  new Request("https://example.test/location-reverse", {
    method: "POST",
    body: JSON.stringify(body),
  });

function setup() {
  const calls: string[] = [];
  const finished: unknown[] = [];
  const deps = {
    enabled: true,
    getCaller: async () =>
      ({ role: "CLUB", enabled: true }) as
        | { role: string; enabled: boolean }
        | null,
    claim: async (key: string) => {
      calls.push(key);
      return { token: "lease" } as {
        token?: string | null;
        cached?: typeof address;
      };
    },
    lookup: async () => {
      calls.push("provider");
      return address;
    },
    finish: async (...args: unknown[]) => {
      finished.push(args);
    },
  };
  return { deps, calls, finished, handler: createLocationReverseHandler(deps) };
}

Deno.test("requires a live enabled location-management role before reading cache", async () => {
  for (
    const caller of [null, { role: "PARENT", enabled: true }, {
      role: "ADMIN",
      enabled: false,
    }]
  ) {
    const state = setup();
    state.deps.getCaller = async () => caller;
    assertEquals((await state.handler(request())).status, caller ? 403 : 401);
    assertEquals(state.calls, []);
  }
  for (const role of ["CLUB", "COACH", "ADMIN"]) {
    const state = setup();
    state.deps.getCaller = async () => ({ role, enabled: true });
    assertEquals((await state.handler(request())).status, 200);
  }
});

Deno.test("rejects invalid coordinates and disabled provider without outbound work", async () => {
  for (
    const body of [null, [], {}, { lat: "45", lng: 21 }, { lat: 91, lng: 21 }, {
      lat: 45,
      lng: -181,
    }]
  ) {
    const state = setup();
    assertEquals((await state.handler(request(body))).status, 400);
    assertEquals(state.calls, []);
  }
  const state = setup();
  state.deps.enabled = false;
  assertEquals((await state.handler(request())).status, 503);
  assertEquals(state.calls, []);
  assertEquals(
    (await state.handler(new Request("https://example.test"))).status,
    405,
  );
});

Deno.test("cache hits avoid the provider and a held global lease returns bounded backoff", async () => {
  const state = setup();
  state.deps.claim = async () => ({ cached: address });
  assertEquals(await (await state.handler(request())).json(), {
    place: address,
  });
  assertEquals(state.calls, []);
  assertEquals(state.finished, []);
  state.deps.claim = async () => ({ token: null });
  const busy = await state.handler(request());
  assertEquals(busy.status, 429);
  assertEquals(busy.headers.get("Retry-After"), "2");
  assertEquals(state.calls, []);
});

Deno.test("success caches by one-meter coordinates and failures release the lease without cached errors", async () => {
  const state = setup();
  assertEquals(await (await state.handler(request())).json(), {
    place: address,
  });
  assertEquals(state.calls, ["45.75690,21.23540", "provider"]);
  assertEquals(state.finished, [["lease", "45.75690,21.23540", address]]);
  state.deps.lookup = async () => {
    throw new Error("upstream failure");
  };
  assertEquals((await state.handler(request())).status, 503);
  assertEquals(state.finished[1], ["lease", "45.75690,21.23540", null]);
});

Deno.test("provider identifies the app and only requests reverse address data", async () => {
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assertEquals(url.origin, "https://photon.koalasec.org");
    assertEquals(url.pathname, "/reverse");
    assertEquals(url.searchParams.get("lat"), "45.75690");
    assertEquals(url.searchParams.get("lon"), "21.23540");
    assertEquals(url.searchParams.getAll("layer"), ["house", "street"]);
    assertEquals(url.searchParams.get("radius"), "0.1");
    assertEquals(url.searchParams.get("lang"), "default");
    assertEquals(
      new Headers(init?.headers).get("User-Agent"),
      "MotionTimisoara/1.0 (https://motiontimisoara-demo.netlify.app)",
    );
    return Response.json({
      features: [{
        properties: {
          street: "Strada Vasile Goldiș",
          housenumber: "8",
          city: "Timișoara",
          county: "Timiș",
          countrycode: "RO",
        },
      }],
    });
  };
  assertEquals(
    await lookupAddress(
      "https://photon.koalasec.org/reverse",
      45.756903,
      21.235401,
      fetcher,
    ),
    address,
  );
});

Deno.test("sparse responses never invent a street and Romanian villages are supported", () => {
  assertEquals(
    parseAddress({
      features: [{
        properties: {
          village: "Dumbrăvița",
          county: "Timiș",
          countrycode: "RO",
        },
      }],
    }),
    { address: null, city: "Dumbrăvița", county: "Timiș" },
  );
  assertEquals(
    parseAddress({
      features: [{
        properties: {
          type: "street",
          name: "Stadtplatz",
          town: "Zell am See",
          county: "Bezirk Zell am See",
          state: "Salzburg",
          countrycode: "AT",
        },
      }],
    }),
    { address: "Stadtplatz", city: "Zell am See", county: "Salzburg" },
  );
  assertEquals(parseAddress({ error: "Unable to geocode" }), null);
  assertEquals(
    parseAddress({
      features: [{
        properties: {
          street: 42,
          name: "Some venue",
          city: "Timișoara",
          county: "Timiș",
          countrycode: "RO",
        },
      }],
    })?.address,
    null,
  );
});

Deno.test("provider errors and stalled requests terminate and clear their deadline", async () => {
  await assertRejects(() =>
    lookupAddress(
      "https://example.test/reverse",
      45,
      21,
      async () => new Response(null, { status: 503 }),
    )
  );
  let aborted = false;
  const fetcher: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("deadline"));
      });
    });
  await assertRejects(() =>
    lookupAddress("https://example.test/reverse", 45, 21, fetcher)
  );
  assertEquals(aborted, true);
});
