export const BNR_FX_URL = "https://curs.bnr.ro/nbrfxrates.xml";

export type BnrRate = {
  date: string;
  eur_ron_millionths: number;
};

export type BnrRateCache = {
  rate: BnrRate;
  fetchedOn: string;
} | null;

export function decimalToMillionths(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const scaled = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"));
  return Number.isInteger(scaled) && scaled > 0 ? scaled : null;
}

export function parseBnrXml(xml: string): BnrRate {
  if (/<html[\s>]/i.test(xml) || !xml.includes("<Cube")) {
    throw new Error("BNR_UNAVAILABLE");
  }
  const cubes = [...xml.matchAll(/<Cube\s+[^>]*\bdate="(\d{4}-\d{2}-\d{2})"[^>]*>/g)];
  if (cubes.length === 0) throw new Error("BNR_UNAVAILABLE");
  const last = cubes[cubes.length - 1];
  const date = last[1];
  const start = last.index ?? 0;
  const next = xml.indexOf("<Cube", start + 1);
  const cubeXml = next === -1 ? xml.slice(start) : xml.slice(start, next);
  let rateText: string | null = null;
  let multiplier = 1;
  for (const tag of cubeXml.matchAll(/<Rate\s+([^>]*)>([^<]*)<\/Rate>/g)) {
    if (!/\bcurrency="EUR"/.test(tag[1])) continue;
    const mult = tag[1].match(/\bmultiplier="(\d+)"/);
    multiplier = mult ? Number(mult[1]) : 1;
    rateText = tag[2].trim();
    break;
  }
  const millionths = rateText ? decimalToMillionths(rateText) : null;
  if (!millionths || !(multiplier > 0)) throw new Error("BNR_UNAVAILABLE");
  const adjusted = millionths / multiplier;
  if (!Number.isInteger(adjusted) || adjusted <= 0) throw new Error("BNR_UNAVAILABLE");
  return { date, eur_ron_millionths: adjusted };
}

export function bucharestCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function secondsUntilBucharestMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const elapsed = Number(map.hour) * 3600 + Number(map.minute) * 60 + Number(map.second);
  return Math.max(1, 86400 - elapsed);
}

function json(body: unknown, status: number, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

export function createBnrRateHandler(opts: {
  fetchXml: () => Promise<string>;
  now?: () => Date;
  cache?: { current: BnrRateCache };
}) {
  const cache = opts.cache ?? { current: null };
  const now = opts.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET" && req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    const today = bucharestCalendarDate(now());
    if (cache.current && cache.current.fetchedOn === today) {
      return json(cache.current.rate, 200, {
        "Cache-Control": `private, max-age=${secondsUntilBucharestMidnight(now())}`,
      });
    }
    try {
      const rate = parseBnrXml(await opts.fetchXml());
      cache.current = { rate, fetchedOn: today };
      return json(rate, 200, {
        "Cache-Control": `private, max-age=${secondsUntilBucharestMidnight(now())}`,
      });
    } catch {
      return json({ error: "Nu am putut citi cursul BNR." }, 502);
    }
  };
}
