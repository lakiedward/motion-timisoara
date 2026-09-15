import type { PushDelivery, PushOutcome } from "./contract.ts";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};
type Requester = typeof fetch;

function serviceAccount(raw: string | undefined): ServiceAccount {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      value?.type !== "service_account" ||
      !/^[a-z0-9-]{6,63}$/.test(value?.project_id ?? "") ||
      typeof value?.client_email !== "string" ||
      !value.client_email.endsWith(".iam.gserviceaccount.com") ||
      typeof value?.private_key !== "string" ||
      !value.private_key.startsWith("-----BEGIN PRIVATE KEY-----")
    ) throw new Error();
    return value;
  } catch {
    throw new Error("FCM configuration unavailable");
  }
}

const base64url = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data)).replace(/=/g, "").replace(/\+/g, "-")
    .replace(/\//g, "_");
const encode = (data: unknown) =>
  base64url(new TextEncoder().encode(JSON.stringify(data)));

export async function googleAssertion(
  raw: string,
  now = Date.now(),
): Promise<{ assertion: string; projectId: string }> {
  const account = serviceAccount(raw);
  const pem = account.private_key.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    "",
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (char) => char.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const issuedAt = Math.floor(now / 1000);
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${
    encode({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt - 30,
      exp: issuedAt + 3500,
    })
  }`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return {
    assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    projectId: account.project_id,
  };
}

function retryAfter(response: Response): number {
  const header = response.headers.get("retry-after");
  if (!header) return 60;
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : Math.ceil((Date.parse(header) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.min(3600, Math.max(60, seconds)) : 60;
}

export function firebaseMessaging(
  raw: string | undefined,
  request: Requester = fetch,
) {
  let token = "";
  let expiresAt = 0;
  let projectId = "";
  return {
    authorize: async (): Promise<string> => {
      if (token && expiresAt > Date.now() + 60_000) return token;
      const assertion = await googleAssertion(raw ?? "");
      projectId = assertion.projectId;
      const response = await request("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: assertion.assertion,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => null);
      if (
        !response.ok || typeof result?.access_token !== "string" ||
        !result.access_token ||
        typeof result?.expires_in !== "number" || result.expires_in <= 0
      ) throw new Error("FCM authorization unavailable");
      token = result.access_token;
      expiresAt = Date.now() + Math.min(3600, result.expires_in) * 1000;
      return token;
    },
    send: async (
      delivery: PushDelivery,
      accessToken: string,
    ): Promise<PushOutcome> => {
      if (!projectId) projectId = serviceAccount(raw).project_id;
      const response = await request(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: delivery.token,
              data: delivery.data,
              android: {
                priority: "high",
                ttl: `${delivery.ttlSeconds}s`,
                restricted_package_name: "com.motiontimisoara.app",
              },
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const result = await response.json().catch(() => null);
      if (response.ok && typeof result?.name === "string") {
        return { outcome: "sent", code: "FCM_ACCEPTED" };
      }
      const details = Array.isArray(result?.error?.details)
        ? result.error.details
        : [];
      const fcmError = details.find((detail: Record<string, unknown>) =>
        detail?.["@type"] ===
          "type.googleapis.com/google.firebase.fcm.v1.FcmError"
      )?.errorCode;
      if (fcmError === "UNREGISTERED") {
        return { outcome: "invalid_token", code: "FCM_UNREGISTERED" };
      }
      if ([401, 403].includes(response.status)) {
        token = "";
        expiresAt = 0;
        return { outcome: "retry", code: "FCM_AUTH", retryAfter: 300 };
      }
      if (
        [408, 429].includes(response.status) || response.status >= 500 ||
        response.ok
      ) {
        return {
          outcome: "retry",
          code: "FCM_UNAVAILABLE",
          retryAfter: retryAfter(response),
        };
      }
      return { outcome: "failed", code: "FCM_REJECTED" };
    },
  };
}
