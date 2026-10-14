const PRODUCTION_ORIGIN = "https://motiontimisoara.com";

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?motiontimisoara\.com$/,
  /^https:\/\/deploy-preview-\d+--motiontimisoara\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

export function stripeReturnBase(
  requestOrigin: string | null,
  configuredOrigin: string | undefined,
): string {
  if (requestOrigin && ALLOWED_ORIGINS.some((pattern) => pattern.test(requestOrigin))) {
    return requestOrigin;
  }
  return (configuredOrigin || PRODUCTION_ORIGIN).replace(/\/+$/, "");
}
