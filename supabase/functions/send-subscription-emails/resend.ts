import type { RenderedEmail } from "../_shared/subscription-email-templates.ts";
import type { EmailSender } from "./run.ts";

export function resendSender(
  apiKey: string,
  from: string,
  fetcher: typeof fetch = fetch,
): EmailSender {
  return {
    async send(to: string, email: RenderedEmail, idempotencyKey: string) {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text }),
      });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
      if (!response.ok || !payload.id) {
        throw new Error(`Resend ${response.status}: ${payload.message ?? "no message id"}`);
      }
      return { id: payload.id };
    },
  };
}
