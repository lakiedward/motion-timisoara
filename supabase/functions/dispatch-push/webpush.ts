import {
  type PushDelivery,
  type PushOutcome,
  webSubscription,
} from "./contract.ts";

type Requester = typeof fetch;
export type Bytes = Uint8Array<ArrayBuffer>;
type VapidKeys = { publicKey: Bytes; privateKey: CryptoKey };

const encoder = new TextEncoder();

export const base64url = (data: Bytes) =>
  btoa(String.fromCharCode(...data)).replace(/=+$/, "").replace(/\+/g, "-")
    .replace(/\//g, "_");

export const fromBase64url = (value: string): Bytes =>
  Uint8Array.from(
    atob(
      value.replace(/-/g, "+").replace(/_/g, "/") +
        "===".slice((value.length + 3) % 4),
    ),
    (char) => char.charCodeAt(0),
  );

const concat = (...parts: Bytes[]): Bytes => {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

async function hkdf(
  salt: Bytes,
  material: Bytes,
  info: Bytes,
  length: number,
) {
  const key = await crypto.subtle.importKey("raw", material, "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info },
      key,
      length * 8,
    ),
  );
}

export async function vapidKeys(raw: string | undefined): Promise<VapidKeys> {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      value?.kty !== "EC" || value?.crv !== "P-256" ||
      ![value?.x, value?.y, value?.d].every((part) =>
        typeof part === "string" && /^[A-Za-z0-9_-]{43}$/.test(part)
      )
    ) throw new Error();
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: value.x, y: value.y, d: value.d },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    return {
      privateKey,
      publicKey: concat(
        new Uint8Array([4]),
        fromBase64url(value.x),
        fromBase64url(value.y),
      ),
    };
  } catch {
    throw new Error("Web push configuration unavailable");
  }
}

export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  now = Date.now(),
) {
  const header = base64url(
    encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const claims = base64url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: subject,
  })));
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keys.privateKey,
      encoder.encode(unsigned),
    ),
  );
  return `vapid t=${unsigned}.${base64url(signature)}, k=${
    base64url(keys.publicKey)
  }`;
}

export async function encryptWebPush(
  payload: Bytes,
  clientPublicKey: Bytes,
  authSecret: Bytes,
  salt = crypto.getRandomValues(new Uint8Array(16)),
) {
  const local = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const localPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", local.publicKey),
  );
  const client = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: client },
      local.privateKey,
      256,
    ),
  );
  const material = await hkdf(
    authSecret,
    shared,
    concat(encoder.encode("WebPush: info\0"), clientPublicKey, localPublic),
    32,
  );
  const contentKey = await hkdf(
    salt,
    material,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    material,
    encoder.encode("Content-Encoding: nonce\0"),
    12,
  );
  const key = await crypto.subtle.importKey(
    "raw",
    contentKey,
    "AES-GCM",
    false,
    [
      "encrypt",
    ],
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      concat(payload, new Uint8Array([2])),
    ),
  );
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(
    salt,
    recordSize,
    new Uint8Array([localPublic.length]),
    localPublic,
    encrypted,
  );
}

function retryAfter(response: Response): number {
  const header = response.headers.get("retry-after");
  if (!header) return 60;
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : Math.ceil((Date.parse(header) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.min(3600, Math.max(60, seconds)) : 60;
}

export function webPushMessaging(
  raw: string | undefined,
  subject = "mailto:contact@motionromania.ro",
  request: Requester = fetch,
) {
  let keys: Promise<VapidKeys> | null = null;
  return {
    send: async (delivery: PushDelivery): Promise<PushOutcome> => {
      const subscription = webSubscription(delivery.token);
      if (!subscription) {
        return { outcome: "invalid_token", code: "WEBPUSH_INVALID" };
      }
      let vapid: VapidKeys;
      try {
        keys ??= vapidKeys(raw);
        vapid = await keys;
      } catch {
        keys = null;
        return { outcome: "retry", code: "WEBPUSH_CONFIG", retryAfter: 600 };
      }
      const body = await encryptWebPush(
        encoder.encode(JSON.stringify(delivery.data)),
        fromBase64url(subscription.keys.p256dh),
        fromBase64url(subscription.keys.auth),
      );
      const response = await request(subscription.endpoint, {
        method: "POST",
        headers: {
          Authorization: await vapidAuthorization(
            subscription.endpoint,
            vapid,
            subject,
          ),
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: String(delivery.ttlSeconds),
          Urgency: "high",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel().catch(() => undefined);
      if (response.ok) return { outcome: "sent", code: "WEBPUSH_ACCEPTED" };
      if ([404, 410].includes(response.status)) {
        return { outcome: "invalid_token", code: "WEBPUSH_GONE" };
      }
      if ([401, 403].includes(response.status)) {
        return { outcome: "retry", code: "WEBPUSH_AUTH", retryAfter: 300 };
      }
      if ([408, 429].includes(response.status) || response.status >= 500) {
        return {
          outcome: "retry",
          code: "WEBPUSH_UNAVAILABLE",
          retryAfter: retryAfter(response),
        };
      }
      return { outcome: "failed", code: "WEBPUSH_REJECTED" };
    },
  };
}
