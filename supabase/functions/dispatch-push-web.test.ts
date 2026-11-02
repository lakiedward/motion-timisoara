import {
  parsePushDelivery,
  type PushDelivery,
  webSubscription,
} from "./dispatch-push/contract.ts";
import {
  base64url,
  type Bytes,
  encryptWebPush,
  fromBase64url,
  vapidAuthorization,
  vapidKeys,
  webPushMessaging,
} from "./dispatch-push/webpush.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const id = "00000000-0000-4000-8000-000000000001";
const encoder = new TextEncoder();

async function hkdf(
  salt: Bytes,
  material: Bytes,
  info: string,
  length: number,
) {
  const key = await crypto.subtle.importKey("raw", material, "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(info) },
      key,
      length * 8,
    ),
  );
}

async function browser() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, publicKey, auth };
}

async function decrypt(
  body: Bytes,
  client: Awaited<ReturnType<typeof browser>>,
) {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idLength = body[20];
  const serverPublic = body.slice(21, 21 + idLength);
  const server = await crypto.subtle.importKey(
    "raw",
    serverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: server },
      client.pair.privateKey,
      256,
    ),
  );
  const info = new Uint8Array([
    ...encoder.encode("WebPush: info\0"),
    ...client.publicKey,
    ...serverPublic,
  ]);
  const ikmKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, [
    "deriveBits",
  ]);
  const material = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: client.auth, info },
      ikmKey,
      256,
    ),
  );
  const cek = await hkdf(salt, material, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(salt, material, "Content-Encoding: nonce\0", 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "decrypt",
  ]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      body.slice(21 + idLength),
    ),
  );
  assert(plain[plain.length - 1] === 2, "last record delimiter");
  return { recordSize, text: new TextDecoder().decode(plain.slice(0, -1)) };
}

async function vapidJwk() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    raw: JSON.stringify({
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      d: jwk.d,
    }),
    verify: pair.publicKey,
  };
}

const subscriptionToken = async (endpoint: string) => {
  const client = await browser();
  return {
    client,
    token: JSON.stringify({
      endpoint,
      keys: {
        p256dh: base64url(client.publicKey),
        auth: base64url(client.auth),
      },
    }),
  };
};

const delivery = (token: string): PushDelivery => ({
  token,
  platform: "web",
  ttlSeconds: 1800,
  data: {
    eventId: id,
    bindingId: id,
    kind: "announcement",
    entityId: id,
    path: "/account/announcements",
    title: "Anunț nou",
    body: "Ai un anunț nou în Motion.",
    expiresAt: String(Date.now() + 3600_000),
  },
});

Deno.test("aes128gcm payload decrypts in the browser key schedule", async () => {
  const client = await browser();
  const body = await encryptWebPush(
    encoder.encode('{"title":"Anunț nou"}'),
    client.publicKey,
    client.auth,
  );
  const result = await decrypt(body, client);
  assert(result.text === '{"title":"Anunț nou"}');
  assert(result.recordSize === 4096);
});

Deno.test("VAPID authorization is a verifiable ES256 token for the push origin", async () => {
  const key = await vapidJwk();
  const keys = await vapidKeys(key.raw);
  const now = Date.UTC(2026, 10, 2, 12);
  const header = await vapidAuthorization(
    "https://fcm.googleapis.com/fcm/send/abc",
    keys,
    "mailto:contact@motionromania.ro",
    now,
  );
  const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=([A-Za-z0-9_-]{87})$/
    .exec(header);
  assert(match, "header shape");
  const claims = JSON.parse(new TextDecoder().decode(fromBase64url(match[2])));
  assert(claims.aud === "https://fcm.googleapis.com");
  assert(claims.sub === "mailto:contact@motionromania.ro");
  assert(claims.exp === now / 1000 + 12 * 3600);
  assert(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key.verify,
      fromBase64url(match[3]),
      encoder.encode(`${match[1]}.${match[2]}`),
    ),
    "signature verifies",
  );
  assert(fromBase64url(match[4])[0] === 4, "uncompressed public key");
});

Deno.test("web subscriptions are limited to known push services", async () => {
  for (
    const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYA%3d",
    ]
  ) {
    assert(
      webSubscription((await subscriptionToken(endpoint)).token),
      endpoint,
    );
  }
  for (
    const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.attacker.test/x",
      "https://attacker.test/fcm.googleapis.com/x",
      "https://user@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest",
    ]
  ) {
    assert(
      !webSubscription((await subscriptionToken(endpoint)).token),
      endpoint,
    );
  }
  assert(!webSubscription("not-json"));
  assert(
    !webSubscription('{"endpoint":"https://fcm.googleapis.com/x","keys":{}}'),
  );
});

Deno.test("prepared web delivery requires a valid subscription and keeps android default", async () => {
  const { token } = await subscriptionToken(
    "https://fcm.googleapis.com/fcm/send/abc",
  );
  const base = delivery(token);
  const web = parsePushDelivery({ ...base });
  assert(web?.platform === "web");
  const legacy = parsePushDelivery({
    token: "android-token-abcdefghijklmnopqrstuvwxyz",
    ttlSeconds: 60,
    data: base.data,
  });
  assert(legacy?.platform === "android", "missing platform means android");
  assert(
    !parsePushDelivery({
      ...base,
      token: "android-token-abcdefghijklmnopqrstuvwxyz",
    }),
  );
  assert(!parsePushDelivery({ ...base, platform: "ios" }));
});

Deno.test("web sender posts an encrypted payload and maps push service responses", async () => {
  const key = await vapidJwk();
  const { client, token } = await subscriptionToken(
    "https://fcm.googleapis.com/fcm/send/abc",
  );
  const requests: { url: string; init: RequestInit }[] = [];
  let status = 201;
  const sender = webPushMessaging(
    key.raw,
    "mailto:contact@motionromania.ro",
    (url, init) => {
      requests.push({ url: String(url), init: init! });
      return Promise.resolve(new Response(null, { status }));
    },
  );
  const sent = await sender.send(delivery(token));
  assert(sent.outcome === "sent" && sent.code === "WEBPUSH_ACCEPTED");
  const request = requests[0];
  const headers = request.init.headers as Record<string, string>;
  assert(request.url === "https://fcm.googleapis.com/fcm/send/abc");
  assert(headers.TTL === "1800" && headers.Urgency === "high");
  assert(headers["Content-Encoding"] === "aes128gcm");
  assert(headers.Authorization.startsWith("vapid t="));
  assert(request.init.redirect === "error");
  const decrypted = await decrypt(request.init.body as Bytes, client);
  assert(JSON.parse(decrypted.text).path === "/account/announcements");
  const outcomes: Record<number, string> = {
    410: "invalid_token",
    404: "invalid_token",
    429: "retry",
    503: "retry",
    401: "retry",
    400: "failed",
    413: "failed",
  };
  for (const [code, outcome] of Object.entries(outcomes)) {
    status = Number(code);
    assert((await sender.send(delivery(token))).outcome === outcome, code);
  }
});

Deno.test("missing VAPID configuration retries without contacting the push service", async () => {
  const { token } = await subscriptionToken(
    "https://fcm.googleapis.com/fcm/send/abc",
  );
  let calls = 0;
  const sender = webPushMessaging(undefined, "mailto:x@y.z", () => {
    calls++;
    return Promise.resolve(new Response(null, { status: 201 }));
  });
  const outcome = await sender.send(delivery(token));
  assert(outcome.outcome === "retry" && outcome.code === "WEBPUSH_CONFIG");
  assert(calls === 0);
});
