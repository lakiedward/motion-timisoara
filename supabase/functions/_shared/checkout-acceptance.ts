import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { TERMS_SHA256, TERMS_VERSION } from "./terms-version.ts";

export { TERMS_SHA256, TERMS_VERSION };

const RULES: Record<string, { table: string; bucket: string; text: boolean }> = {
  CAMP: { table: "camps", bucket: "camp-rules", text: true },
  COURSE: { table: "courses", bucket: "course-rules", text: false },
  ACTIVITY: { table: "activities", bucket: "activity-rules", text: false },
};

export interface ClientAcceptance {
  termsVersion?: unknown;
  rulesFingerprint?: unknown;
}

export interface CheckoutAcceptance {
  termsVersion: string;
  termsSha256: string;
  clientTermsVersion: string | null;
  rulesSource: "TEXT" | "FILE" | null;
  rulesFilePath: string | null;
  rulesFileName: string | null;
  rulesSha256: string | null;
}

export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function rulesFingerprint(file: string | null, text: string | null): Promise<string> {
  if (file) return `file:${file}`;
  if (text) return `text:${await sha256Hex(text)}`;
  return "none";
}

export async function buildCheckoutAcceptance(
  db: SupabaseClient,
  kind: string,
  entityId: string,
  client: ClientAcceptance | undefined,
): Promise<CheckoutAcceptance> {
  const clientTermsVersion = typeof client?.termsVersion === "string" ? client.termsVersion.slice(0, 20) : null;
  if (clientTermsVersion !== null && clientTermsVersion !== TERMS_VERSION) {
    throw enrollmentJson({
      error: "Termenii și condițiile s-au actualizat. Citește-i din nou și confirmă.",
      code: "TERMS_CHANGED",
    }, 409);
  }

  const source = RULES[kind];
  const columns = source.text ? "rules, rules_file_storage_path, rules_file_name" : "rules_file_storage_path, rules_file_name";
  const { data, error } = await db.from(source.table).select(columns).eq("id", entityId).single();
  if (error || !data) throw enrollmentJson({ error: "Nu am putut citi regulamentul ofertei. Reîncearcă." }, 500);
  const row = data as unknown as { rules?: string | null; rules_file_storage_path: string | null; rules_file_name: string | null };
  const path = row.rules_file_storage_path || null;
  const text = source.text ? (row.rules ?? "").trim() || null : null;

  if (typeof client?.rulesFingerprint === "string" && client.rulesFingerprint !== await rulesFingerprint(path, text)) {
    throw enrollmentJson({
      error: "Regulamentul ofertei s-a schimbat. Citește-l din nou și confirmă.",
      code: "RULES_CHANGED",
    }, 409);
  }

  let rulesSha256: string | null = null;
  if (path) {
    const file = await db.storage.from(source.bucket).download(path);
    if (file.error || !file.data) {
      throw enrollmentJson({ error: "Nu am putut verifica regulamentul ofertei. Reîncearcă." }, 503);
    }
    rulesSha256 = await sha256Hex(await file.data.arrayBuffer());
  } else if (text) {
    rulesSha256 = await sha256Hex(text);
  }

  return {
    termsVersion: TERMS_VERSION,
    termsSha256: TERMS_SHA256,
    clientTermsVersion,
    rulesSource: path ? "FILE" : text ? "TEXT" : null,
    rulesFilePath: path,
    rulesFileName: path ? row.rules_file_name : null,
    rulesSha256,
  };
}
