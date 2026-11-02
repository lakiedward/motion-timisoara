const CONTROL_KEY = [7, 5, 3, 2, 1, 7, 5, 3, 2];

export function normalizeCui(value: string): string {
  return value.replace(/\s+/g, "").replace(/^ro/i, "");
}

export function isValidCui(value: string): boolean {
  const cui = normalizeCui(value);
  if (!/^[1-9][0-9]{1,9}$/.test(cui)) return false;
  const body = cui.slice(0, -1).padStart(9, "0");
  const sum = [...body].reduce(
    (total, digit, index) => total + Number(digit) * CONTROL_KEY[index],
    0,
  );
  const control = (sum * 10) % 11;
  return (control === 10 ? 0 : control) === Number(cui.at(-1));
}

export type AnafCompany = {
  cui: string;
  name: string;
  address: string | null;
  regNumber: string | null;
};

export type CompanyLookup =
  | { status: "found"; company: AnafCompany }
  | { status: "not_found" | "deregistered" | "inactive" | "unavailable" };

export const ANAF_COMPANY_URL =
  "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseAnafCompany(cui: string, body: unknown): CompanyLookup {
  if (!body || typeof body !== "object") return { status: "unavailable" };
  const { found, notFound } = body as { found?: unknown; notFound?: unknown };
  const match = Array.isArray(found)
    ? found.find((entry) =>
      String(entry?.date_generale?.cui ?? "") === cui
    )
    : undefined;
  if (!match) {
    return Array.isArray(notFound) && notFound.map(String).includes(cui)
      ? { status: "not_found" }
      : { status: "unavailable" };
  }
  const general = match.date_generale ?? {};
  const inactive = match.stare_inactiv ?? {};
  const name = text(general.denumire);
  if (!name) return { status: "unavailable" };
  if (
    text(inactive.dataRadiere) ||
    /^radiere/i.test(text(general.stare_inregistrare) ?? "")
  ) {
    return { status: "deregistered" };
  }
  if (inactive.statusInactivi === true) return { status: "inactive" };
  return {
    status: "found",
    company: {
      cui,
      name,
      address: text(general.adresa),
      regNumber: text(general.nrRegCom),
    },
  };
}

export async function lookupAnafCompany(
  value: string,
  fetcher: typeof fetch = fetch,
  today: Date = new Date(),
): Promise<CompanyLookup> {
  const cui = normalizeCui(value);
  if (!isValidCui(cui)) return { status: "not_found" };
  try {
    const response = await fetcher(ANAF_COMPANY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { cui: Number(cui), data: today.toISOString().slice(0, 10) },
      ]),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: "unavailable" };
    return parseAnafCompany(cui, await response.json());
  } catch {
    return { status: "unavailable" };
  }
}
