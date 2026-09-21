import {
  BNR_FX_URL,
  bucharestCalendarDate,
  createBnrRateHandler,
  decimalToMillionths,
  parseBnrXml,
  secondsUntilBucharestMidnight,
} from "./bnr-rate/rate.ts";

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd">
  <Header><PublishingDate>2026-09-18</PublishingDate></Header>
  <Body>
    <OrigCurrency>RON</OrigCurrency>
    <Cube date="2026-09-19">
      <Rate currency="AUD">2.9101</Rate>
      <Rate currency="EUR">5.0731</Rate>
      <Rate currency="HUF" multiplier="100">1.2345</Rate>
    </Cube>
  </Body>
</DataSet>`;

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("the official daily XML lives on curs.bnr.ro", () => {
  assert(BNR_FX_URL === "https://curs.bnr.ro/nbrfxrates.xml");
});

Deno.test("EUR from the official cube becomes integer millionths", () => {
  const parsed = parseBnrXml(SAMPLE);
  assert(parsed.date === "2026-09-19");
  assert(parsed.eur_ron_millionths === 5073100);
  assert(decimalToMillionths("5,0731") === 5073100);
});

Deno.test("the current BNR xmlns still yields EUR millionths", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="https://www.bnr.ro/xsd">
  <Body><OrigCurrency>RON</OrigCurrency>
    <Cube date="2026-09-21"><Rate currency="EUR">5.2649</Rate></Cube>
  </Body>
</DataSet>`;
  const parsed = parseBnrXml(xml);
  assert(parsed.date === "2026-09-21");
  assert(parsed.eur_ron_millionths === 5264900);
});

Deno.test("the last Cube wins and EUR may carry multiplier 1", () => {
  const xml = `<Cube date="2026-09-17"><Rate currency="EUR">4.9000</Rate></Cube>
<Cube date="2026-09-18"><Rate currency="EUR" multiplier="1">5.0001</Rate></Cube>`;
  const parsed = parseBnrXml(xml);
  assert(parsed.date === "2026-09-18");
  assert(parsed.eur_ron_millionths === 5000100);
});

Deno.test("HTML, empty XML and a missing EUR row are unavailable", () => {
  for (const xml of [
    "<!doctype html><html><body>BNR</body></html>",
    "<DataSet><Body></Body></DataSet>",
    `<Cube date="2026-09-19"><Rate currency="USD">4.12</Rate></Cube>`,
    "",
  ]) {
    let failed = false;
    try {
      parseBnrXml(xml);
    } catch {
      failed = true;
    }
    assert(failed, `expected unavailable for ${xml.slice(0, 40)}`);
  }
});

Deno.test("the day's cache is reused; yesterday is not a fallback", async () => {
  let fetches = 0;
  const box: { current: { rate: { date: string; eur_ron_millionths: number }; fetchedOn: string } | null } =
    { current: null };
  const monday = new Date("2026-09-21T09:00:00+03:00");
  const tuesday = new Date("2026-09-22T09:00:00+03:00");
  let now = monday;
  const handler = createBnrRateHandler({
    cache: box,
    now: () => now,
    fetchXml: async () => {
      fetches += 1;
      return SAMPLE;
    },
  });
  const first = await handler(new Request("https://local.test/bnr-rate", { method: "POST" }));
  const second = await handler(new Request("https://local.test/bnr-rate", { method: "GET" }));
  assert(first.status === 200 && second.status === 200);
  assert(fetches === 1);
  assert((await second.json()).eur_ron_millionths === 5073100);
  assert(first.headers.get("Cache-Control")?.startsWith("private, max-age=") === true);

  now = tuesday;
  let failedFetches = 0;
  const failing = createBnrRateHandler({
    cache: box,
    now: () => now,
    fetchXml: async () => {
      failedFetches += 1;
      throw new Error("down");
    },
  });
  const blocked = await failing(new Request("https://local.test/bnr-rate", { method: "POST" }));
  assert(blocked.status === 502);
  assert(failedFetches === 1);
  const body = await blocked.json();
  assert(body.error === "Nu am putut citi cursul BNR.");
});

Deno.test("a failed first fetch does not invent a rate", async () => {
  const handler = createBnrRateHandler({
    fetchXml: async () => {
      throw new Error("down");
    },
  });
  const response = await handler(new Request("https://local.test/bnr-rate", { method: "POST" }));
  assert(response.status === 502);
  assert((await response.json()).eur_ron_millionths === undefined);
});

Deno.test("Bucharest midnight cache budget is the rest of the local day", () => {
  const noon = new Date("2026-09-21T12:00:00+03:00");
  assert(bucharestCalendarDate(noon) === "2026-09-21");
  const seconds = secondsUntilBucharestMidnight(noon);
  assert(seconds > 11 * 3600 && seconds <= 12 * 3600);
});
