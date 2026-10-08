export type ReverseAddress = {
  address: string | null;
  city: string | null;
  county: string | null;
};

export class ReverseProviderError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseAddress(value: unknown): ReverseAddress | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.features)) return null;
  const feature = body.features[0];
  if (!feature || typeof feature !== "object") return null;
  const fields = feature.properties;
  if (!fields || typeof fields !== "object") return null;
  const street = text(fields.street) ??
    (fields.type === "street" ? text(fields.name) : null);
  return {
    address: street
      ? [street, text(fields.housenumber)].filter(Boolean).join(" ")
      : null,
    city: text(fields.city) ?? text(fields.town) ?? text(fields.village) ??
      (fields.type === "city" ? text(fields.name) : null),
    county: text(fields.countrycode)?.toUpperCase() === "RO"
      ? text(fields.county) ?? text(fields.state)
      : text(fields.state) ?? text(fields.county),
  };
}

export async function lookupAddress(
  endpoint: string,
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch,
): Promise<ReverseAddress | null> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Invalid provider URL");
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lng.toFixed(5),
    limit: "1",
    lang: "default",
    radius: "0.1",
  });
  params.append("layer", "house");
  params.append("layer", "street");
  url.search = params.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "MotionTimisoara/1.0 (https://motiontimisoara-demo.netlify.app)",
      },
      redirect: "error",
    });
    if (!response.ok) {
      throw new ReverseProviderError(`UPSTREAM_HTTP_${response.status}`);
    }
    return parseAddress(await response.json());
  } catch (error) {
    if (error instanceof ReverseProviderError) throw error;
    throw new ReverseProviderError(
      controller.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}
