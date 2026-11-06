import type { SubscriptionEmailKind } from "./subscription-emails.ts";

export const SUBSCRIPTION_EMAIL_FROM = "Motion România <no-reply@motionromania.ro>";

export interface SubscriptionEmailContext {
  kind: SubscriptionEmailKind;
  subscriberType: "COACH" | "CLUB";
  recipientName: string | null;
  clubName: string | null;
  planName: string | null;
  planPriceBani: number | null;
  hasCard: boolean;
  date: string | null;
  amountBani: number | null;
  currency: string | null;
  periodEnd: string | null;
  invoiceUrl: string | null;
  siteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface Content {
  subject: string;
  title: string;
  paragraphs: string[];
  cta: string;
  extraLink: { label: string; url: string } | null;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function formatRoDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(new Date(value));
}

export function formatMoney(bani: number | null, currency: string | null): string {
  if (bani === null) return "";
  const amount = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(bani / 100);
  return !currency || currency.toUpperCase() === "RON" ? `${amount} lei` : `${amount} ${currency.toUpperCase()}`;
}

export function subscriptionPageUrl(siteUrl: string, subscriberType: "COACH" | "CLUB"): string {
  return `${siteUrl.replace(/\/+$/, "")}/${subscriberType === "CLUB" ? "club" : "coach"}/abonament`;
}

function content(context: SubscriptionEmailContext): Content {
  const offers = context.subscriberType === "CLUB" && context.clubName
    ? `ofertele clubului ${context.clubName}`
    : "ofertele tale";
  const plan = context.planName ? `abonamentul ${context.planName}` : "abonamentul tău";
  const date = formatRoDate(context.date);
  const invoiceLink = context.invoiceUrl ? { label: "Vezi chitanța plății", url: context.invoiceUrl } : null;

  switch (context.kind) {
    case "TRIAL_ENDS_14":
    case "TRIAL_ENDS_3": {
      const soon = context.kind === "TRIAL_ENDS_3";
      if (context.hasCard) {
        const price = context.planPriceBani ? ` cu ${formatMoney(context.planPriceBani, "RON")} pe lună` : "";
        return {
          subject: `Perioada de probă se încheie pe ${date}`,
          title: soon ? "Perioada de probă se încheie în curând" : "Perioada de probă se apropie de final",
          paragraphs: [
            `Perioada de probă gratuită se încheie pe ${date}. Din acea zi, ${plan} continuă automat și cardul tău va fi debitat${price}.`,
            "Nu trebuie să faci nimic. Dacă vrei să schimbi pachetul sau să anulezi, intră pe pagina Abonament înainte de această dată.",
          ],
          cta: "Vezi abonamentul",
          extraLink: null,
        };
      }
      return {
        subject: soon ? `Mai ai puțin: perioada de probă se încheie pe ${date}` : `Perioada de probă se încheie pe ${date}`,
        title: soon ? "Perioada de probă se încheie în curând" : "Perioada de probă se apropie de final",
        paragraphs: [
          `Perioada de probă gratuită pe Motion România se încheie pe ${date}.`,
          `Ca ${offers} să rămână vizibile pentru părinți și să primești în continuare înscrieri, alege un abonament înainte de această dată.`,
        ],
        cta: "Alege abonamentul",
        extraLink: null,
      };
    }
    case "PAYMENT_FAILED":
      return {
        subject: "Plata abonamentului nu a reușit",
        title: "Plata abonamentului nu a reușit",
        paragraphs: [
          `Nu am putut încasa ${formatMoney(context.amountBani, context.currency) || "plata"} pentru ${plan}.`,
          "Verifică sau schimbă cardul pe pagina Abonament. Reîncercăm automat plata în zilele următoare.",
          `Dacă plata nu reușește în 7 zile, ${offers} nu mai primesc înscrieri noi până la reactivare.`,
        ],
        cta: "Actualizează plata",
        extraLink: invoiceLink,
      };
    case "PAYMENT_CONFIRMED":
      return {
        subject: "Am primit plata abonamentului",
        title: "Mulțumim, plata a fost primită",
        paragraphs: [
          `Am încasat ${formatMoney(context.amountBani, context.currency)} pentru ${plan}.`,
          context.periodEnd
            ? `Abonamentul este activ până pe ${formatRoDate(context.periodEnd)} și se reînnoiește automat.`
            : "Abonamentul este activ și se reînnoiește automat.",
        ],
        cta: "Vezi abonamentul",
        extraLink: invoiceLink,
      };
    case "CANCELLATION_CONFIRMED":
      return {
        subject: "Am înregistrat anularea abonamentului",
        title: "Abonamentul a fost anulat",
        paragraphs: [
          `Am înregistrat anularea pentru ${plan}. Nu se mai face nicio plată.`,
          date
            ? `Până pe ${date}, ${offers} rămân vizibile pentru părinți și primesc înscrieri. După această dată nu mai apar, dar datele și ofertele rămân salvate.`
            : `Până la finalul perioadei plătite, ${offers} rămân vizibile pentru părinți și primesc înscrieri.`,
          "Te-ai răzgândit? Poți reactiva abonamentul din pagina Abonament, cu „Gestionează abonamentul”, înainte de această dată.",
        ],
        cta: "Vezi abonamentul",
        extraLink: null,
      };
    case "SUBSCRIPTION_ENDED":
      return {
        subject: "Abonamentul tău Motion România s-a încheiat",
        title: "Abonamentul s-a încheiat",
        paragraphs: [
          date ? `Abonamentul tău pe Motion România s-a încheiat pe ${date}.` : "Abonamentul tău pe Motion România s-a încheiat.",
          `De acum, ${offers} nu mai apar pentru părinți și nu mai primesc înscrieri noi. Datele și ofertele rămân salvate.`,
          "Le poți reactiva oricând, alegând un abonament.",
        ],
        cta: "Reactivează abonamentul",
        extraLink: null,
      };
  }
}

export function renderSubscriptionEmail(context: SubscriptionEmailContext): RenderedEmail {
  const body = content(context);
  const url = subscriptionPageUrl(context.siteUrl, context.subscriberType);
  const greeting = context.recipientName ? `Bună, ${context.recipientName},` : "Bună,";
  const role = context.subscriberType === "CLUB" ? "de club" : "de antrenor";
  const footer = `Primești acest email pentru că ai un cont ${role} pe Motion România.`;

  const paragraph = (text: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#334155">${escapeHtml(text)}</p>`;
  const extra = body.extraLink
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:20px"><a href="${escapeHtml(body.extraLink.url)}" style="color:#2563eb">${escapeHtml(body.extraLink.label)}</a></p>`
    : "";

  const html = [
    '<div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 24px">',
    '<p style="margin:0 0 20px;font-size:18px;font-weight:700">Motion <span style="color:#2563eb">România</span></p>',
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:28px">${escapeHtml(body.title)}</h1>`,
    paragraph(greeting),
    ...body.paragraphs.map(paragraph),
    `<p style="margin:4px 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(body.cta)}</a></p>`,
    extra,
    `<p style="margin:0;font-size:13px;line-height:20px;color:#475569">${escapeHtml(footer)}</p>`,
    "</div>",
    '<p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#64748b;text-align:center">Motion România · cursuri, tabere și activități sportive pentru copii · <a href="https://motionromania.ro" style="color:#64748b">motionromania.ro</a></p>',
    "</div>",
  ].join("\n");

  const text = [
    greeting,
    "",
    ...body.paragraphs.flatMap((item) => [item, ""]),
    `${body.cta}: ${url}`,
    ...(body.extraLink ? [`${body.extraLink.label}: ${body.extraLink.url}`] : []),
    "",
    footer,
    "Motion România · motionromania.ro",
  ].join("\n");

  return { subject: body.subject, html, text };
}
