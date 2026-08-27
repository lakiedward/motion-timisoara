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

/**
 * Whether the target under test talks to a real Supabase project.
 *
 * CI builds the app with placeholder credentials when no secret is configured.
 * The client boots — `createClient` only needs a well-formed URL — but every
 * request dies at DNS, so no response ever arrives. An assertion that Supabase
 * answered then describes the environment, not the code, and fails for a reason
 * nobody can fix in a pull request.
 *
 * Default is `true` on purpose: local runs and production runs keep behaving
 * exactly as before, and only a build that declares itself placeholder opts out.
 */
export const hasLiveBackend = (): boolean => process.env.E2E_PLACEHOLDER_BACKEND !== '1'
