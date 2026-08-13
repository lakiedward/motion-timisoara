/**
 * Both E2E suites run against two very different targets:
 *   - the local Vite preview of the React app (BASE_URL=http://localhost:3017)
 *   - the public domain (default baseURL, https://www.motiontimisoara.com)
 *
 * Assertions that describe the React build (Romanian copy) or HTTPS-only
 * production hardening only make sense on one of the two, so both suites gate
 * them through this single predicate instead of keeping private copies that
 * can drift apart.
 */
export const isLocalPreview = (baseURL: string | undefined): boolean =>
  !!baseURL && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(baseURL)
