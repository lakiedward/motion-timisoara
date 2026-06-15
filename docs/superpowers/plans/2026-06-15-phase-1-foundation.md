# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `motiontimisoaraApp/` project — Vite + React + TS, Tailwind + shadcn/ui, the core libraries, a typed Supabase client, the app shell with providers + routing, the testing harness, and a Capacitor (Android + iOS) wrapper — so every later phase builds on a verified, runnable base (web build + native sync both green).

**Architecture:** Single Vite SPA. Providers compose in `App.tsx` (QueryClientProvider → AuthProvider → RouterProvider, with Stripe Elements mounted where needed). A platform abstraction (`lib/platform.ts`) lets the same bundle run on web and inside Capacitor. Tests run on Vitest + React Testing Library. Capacitor wraps the built `dist/` for native.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui, React Router v7, TanStack Query v5, Zustand, react-hook-form + zod, @supabase/supabase-js, @stripe/stripe-js + @stripe/react-stripe-js, leaflet + react-leaflet, Capacitor 7 (+ app, preferences, camera, geolocation, push-notifications, status-bar, splash-screen), Vitest + React Testing Library.

> **Environment note (Windows):** commands are PowerShell-friendly. iOS (`cap add ios`) creates the platform folder but `pod install` requires macOS — that step is expected to no-op/warn on Windows and is finished on Codemagic CI later. All other steps run locally on Windows.

> **Convention:** all app commands run from `motiontimisoaraApp/`. Each task ends with a commit. The branch for all rebuild work is `claude/react-rebuild`.

---

### Task 0: Create the working branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to the rebuild branch**

Run (from repo root):
```
git checkout -b claude/react-rebuild
```
Expected: `Switched to a new branch 'claude/react-rebuild'`

---

### Task 1: Scaffold the Vite + React + TS project

**Files:**
- Create: `motiontimisoaraApp/` (Vite scaffold: `package.json`, `index.html`, `tsconfig*.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, …)

- [ ] **Step 1: Scaffold with the Vite react-ts template**

Run (from repo root):
```
npm create vite@latest motiontimisoaraApp -- --template react-ts
```
Expected: `Scaffolding project in ...motiontimisoaraApp` then "Done."

- [ ] **Step 2: Install base dependencies**

Run (from `motiontimisoaraApp/`):
```
npm install
```
Expected: dependencies install, `node_modules/` created, exit 0.

- [ ] **Step 3: Verify the dev build works**

Run: `npm run build`
Expected: `dist/` produced, exit 0 (TypeScript + Vite build succeed).

- [ ] **Step 4: Add a root .gitignore entry for the app build/native artifacts**

Append to `motiontimisoaraApp/.gitignore` (Vite already ignores `node_modules`, `dist`):
```
# Capacitor native build artifacts
android/app/build/
android/.gradle/
ios/App/Pods/
ios/App/build/
# Env
.env
.env.local
```

- [ ] **Step 5: Commit**

```
git add motiontimisoaraApp
git commit -m "chore(app): scaffold Vite + React + TS for motiontimisoaraApp"
```

---

### Task 2: Tailwind CSS v4

**Files:**
- Modify: `motiontimisoaraApp/vite.config.ts`
- Modify: `motiontimisoaraApp/src/index.css`
- Modify: `motiontimisoaraApp/src/App.tsx` (smoke-style a heading)

- [ ] **Step 1: Install Tailwind v4 + the Vite plugin**

Run: `npm install tailwindcss @tailwindcss/vite`

- [ ] **Step 2: Register the plugin in `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3: Replace `src/index.css` with the Tailwind entry**

```css
@import 'tailwindcss';
```

- [ ] **Step 4: Add the `@` path alias to `tsconfig.app.json`**

In `compilerOptions` add:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 5: Smoke-test a Tailwind class in `src/App.tsx`**

Replace `App.tsx` body with:
```tsx
function App() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50">
      <h1 className="text-3xl font-bold text-slate-900">Motion Timisoara</h1>
    </main>
  )
}
export default App
```

- [ ] **Step 6: Verify build + dev server renders Tailwind**

Run: `npm run build`
Expected: exit 0.
Then start the dev server with the preview tool (preview_start) and confirm the heading renders centered with the gray background (preview_screenshot).

- [ ] **Step 7: Commit**

```
git add motiontimisoaraApp
git commit -m "feat(app): add Tailwind CSS v4 + @ path alias"
```

---

### Task 3: shadcn/ui init + Button primitive

**Files:**
- Create: `motiontimisoaraApp/components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Initialize shadcn/ui**

Run: `npx shadcn@latest init -d`
(`-d` = accept defaults; choose the Tailwind v4 / `@` alias config when prompted if not auto-detected.)
Expected: `components.json` + `src/lib/utils.ts` (with `cn`) created.

- [ ] **Step 2: Add the Button component**

Run: `npx shadcn@latest add button`
Expected: `src/components/ui/button.tsx` created.

- [ ] **Step 3: Render a Button in `App.tsx` to confirm wiring**

```tsx
import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="grid min-h-dvh place-items-center gap-4 bg-slate-50">
      <h1 className="text-3xl font-bold text-slate-900">Motion Timisoara</h1>
      <Button>Începe</Button>
    </main>
  )
}
export default App
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exit 0; the styled button renders (preview_screenshot).

- [ ] **Step 5: Commit**

```
git add motiontimisoaraApp
git commit -m "feat(app): init shadcn/ui + Button primitive"
```

---

### Task 4: Install core runtime libraries

**Files:** `motiontimisoaraApp/package.json` (deps only)

- [ ] **Step 1: Install app libraries**

Run:
```
npm install react-router-dom @tanstack/react-query zustand react-hook-form zod @hookform/resolvers @supabase/supabase-js @stripe/stripe-js @stripe/react-stripe-js leaflet react-leaflet
```

- [ ] **Step 2: Install type-only dev deps**

Run:
```
npm install -D @types/leaflet
```

- [ ] **Step 3: Verify install + typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0 (no type errors from the fresh install).

- [ ] **Step 4: Commit**

```
git add motiontimisoaraApp/package.json motiontimisoaraApp/package-lock.json
git commit -m "chore(app): add core runtime libraries (router, query, supabase, stripe, leaflet, forms)"
```

---

### Task 5: Testing harness (Vitest + RTL)

**Files:**
- Modify: `motiontimisoaraApp/vite.config.ts`
- Create: `motiontimisoaraApp/src/test/setup.ts`, `motiontimisoaraApp/src/test/smoke.test.tsx`
- Modify: `motiontimisoaraApp/package.json` (scripts)

- [ ] **Step 1: Install Vitest + Testing Library**

Run:
```
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Configure Vitest in `vite.config.ts`**

Add the `test` block (and the triple-slash ref at top):
```ts
/// <reference types="vitest/config" />
// ...existing imports/plugins/resolve...
export default defineConfig({
  // ...plugins, resolve as before...
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

- [ ] **Step 3: Create the test setup file**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Write a smoke test (failing first — component not rendered yet)**

`src/test/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from '@/App'

test('renders the brand heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Motion Timisoara' })).toBeInTheDocument()
})
```

- [ ] **Step 5: Add test scripts to `package.json`**

In `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc -p tsconfig.app.json --noEmit"
```

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS (1 test). If `App` import path fails, the `@` alias must also be resolvable by Vitest — it is, via the shared `resolve.alias` in `vite.config.ts`.

- [ ] **Step 7: Commit**

```
git add motiontimisoaraApp
git commit -m "test(app): add Vitest + RTL harness with smoke test"
```

---

### Task 6: `lib/money.ts` (bani ↔ RON) with tests

**Files:**
- Create: `motiontimisoaraApp/src/lib/money.ts`, `motiontimisoaraApp/src/lib/money.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/money.test.ts`:
```ts
import { baniToRon, ronToBani, formatRon } from '@/lib/money'

test('baniToRon converts minor units to major', () => {
  expect(baniToRon(12345)).toBe(123.45)
  expect(baniToRon(0)).toBe(0)
})

test('ronToBani converts major units to integer minor units', () => {
  expect(ronToBani(123.45)).toBe(12345)
  expect(ronToBani(10)).toBe(1000)
})

test('ronToBani rounds to the nearest bani (no float drift)', () => {
  expect(ronToBani(19.99)).toBe(1999)
})

test('formatRon renders Romanian currency from bani', () => {
  // Non-breaking spaces vary by ICU; assert the meaningful parts.
  const out = formatRon(12345)
  expect(out).toContain('123,45')
  expect(out.toLowerCase()).toContain('lei')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/money.test.ts`
Expected: FAIL ("Cannot find module '@/lib/money'").

- [ ] **Step 3: Implement `src/lib/money.ts`**

```ts
/** All monetary amounts are stored in the DB as minor units (bani). */
export function baniToRon(bani: number): number {
  return Math.round(bani) / 100
}

export function ronToBani(ron: number): number {
  return Math.round(ron * 100)
}

const formatter = new Intl.NumberFormat('ro-RO', {
  style: 'currency',
  currency: 'RON',
})

export function formatRon(bani: number): string {
  return formatter.format(baniToRon(bani))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/money.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add motiontimisoaraApp/src/lib/money.ts motiontimisoaraApp/src/lib/money.test.ts
git commit -m "feat(app): add money helpers (bani <-> RON, formatRon) + tests"
```

---

### Task 7: `lib/platform.ts` (web/native abstraction) with tests

**Files:**
- Create: `motiontimisoaraApp/src/lib/platform.ts`, `motiontimisoaraApp/src/lib/platform.test.ts`

- [ ] **Step 1: Install Capacitor core (needed for the platform check)**

Run: `npm install @capacitor/core`

- [ ] **Step 2: Write failing test**

`src/lib/platform.test.ts`:
```ts
import { isNative } from '@/lib/platform'

test('isNative is false in the jsdom (web) test environment', () => {
  expect(isNative()).toBe(false)
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/platform.test.ts`
Expected: FAIL ("Cannot find module '@/lib/platform'").

- [ ] **Step 4: Implement `src/lib/platform.ts`**

```ts
import { Capacitor } from '@capacitor/core'

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export function platform(): 'web' | 'ios' | 'android' {
  return Capacitor.getPlatform() as 'web' | 'ios' | 'android'
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/platform.test.ts`
Expected: PASS (1 test). (`Capacitor.isNativePlatform()` returns false on web.)

- [ ] **Step 6: Commit**

```
git add motiontimisoaraApp/src/lib/platform.ts motiontimisoaraApp/src/lib/platform.test.ts motiontimisoaraApp/package.json motiontimisoaraApp/package-lock.json
git commit -m "feat(app): add web/native platform abstraction + test"
```

---

### Task 8: Supabase client singleton + env handling

**Files:**
- Create: `motiontimisoaraApp/src/lib/supabase.ts`, `motiontimisoaraApp/src/lib/database.types.ts`, `motiontimisoaraApp/.env.example`, `motiontimisoaraApp/src/vite-env.d.ts` (augment)

- [ ] **Step 1: Create a placeholder generated-types file**

`src/lib/database.types.ts` (replaced by `supabase gen types` at Phase 4):
```ts
// Generated from the Supabase schema via `supabase gen types typescript`.
// Placeholder until the live project exists (Phase 4). Keep the export name stable.
export type Database = Record<string, never>
```

- [ ] **Step 2: Type the Vite env vars**

Create/append `src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Implement the client with a platform-aware storage adapter**

`src/lib/supabase.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import type { Database } from '@/lib/database.types'
import { isNative } from '@/lib/platform'

// On native, persist the session in Capacitor Preferences (secure device storage).
// On web, supabase-js defaults to localStorage.
const nativeStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => Preferences.set({ key, value }),
  removeItem: async (key: string) => Preferences.remove({ key }),
}

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isNative(),
    ...(isNative() ? { storage: nativeStorage as never } : {}),
  },
})
```

- [ ] **Step 4: Install the Preferences plugin used above**

Run: `npm install @capacitor/preferences`

- [ ] **Step 5: Create `.env.example`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

- [ ] **Step 6: Create a local `.env` so the build resolves env vars (placeholders OK for now)**

Create `motiontimisoaraApp/.env` (git-ignored) by copying `.env.example` values.

- [ ] **Step 7: Verify typecheck + build**

Run: `npm run typecheck`
Expected: exit 0.
Run: `npm run build`
Expected: exit 0.

- [ ] **Step 8: Commit**

```
git add motiontimisoaraApp/src/lib/supabase.ts motiontimisoaraApp/src/lib/database.types.ts motiontimisoaraApp/.env.example motiontimisoaraApp/src/vite-env.d.ts motiontimisoaraApp/package.json motiontimisoaraApp/package-lock.json
git commit -m "feat(app): add typed Supabase client with platform-aware session storage"
```

---

### Task 9: App shell — providers + router

**Files:**
- Create: `motiontimisoaraApp/src/lib/query.ts`, `motiontimisoaraApp/src/routes/router.tsx`, `motiontimisoaraApp/src/routes/RootLayout.tsx`, `motiontimisoaraApp/src/features/public/HomePage.tsx`, `motiontimisoaraApp/src/features/NotFoundPage.tsx`
- Modify: `motiontimisoaraApp/src/App.tsx`, `motiontimisoaraApp/src/main.tsx`, `motiontimisoaraApp/src/test/smoke.test.tsx`

- [ ] **Step 1: Create the TanStack Query client**

`src/lib/query.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})
```

- [ ] **Step 2: Create the root layout (outlet host)**

`src/routes/RootLayout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'

export default function RootLayout() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 3: Create the Home and NotFound pages**

`src/features/public/HomePage.tsx`:
```tsx
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-items-center gap-4">
      <h1 className="text-3xl font-bold">Motion Timisoara</h1>
      <Button>Începe</Button>
    </main>
  )
}
```

`src/features/NotFoundPage.tsx`:
```tsx
export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <p className="text-xl">404 — Pagina nu a fost găsită</p>
    </main>
  )
}
```

- [ ] **Step 4: Create the router**

`src/routes/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/routes/RootLayout'
import HomePage from '@/features/public/HomePage'
import NotFoundPage from '@/features/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
```

- [ ] **Step 5: Compose providers in `App.tsx`**

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/lib/query'
import { router } from '@/routes/router'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 6: Ensure `main.tsx` renders `<App />`** (it does by default from the scaffold; keep `StrictMode`). No change unless the scaffold differs.

- [ ] **Step 7: Update the smoke test to render HomePage (App now needs a router and renders RouterProvider)**

Replace `src/test/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import HomePage from '@/features/public/HomePage'

test('home page renders the brand heading', () => {
  render(<HomePage />)
  expect(screen.getByRole('heading', { name: 'Motion Timisoara' })).toBeInTheDocument()
})
```

- [ ] **Step 8: Run tests + build**

Run: `npm test`
Expected: PASS (all tests).
Run: `npm run build`
Expected: exit 0.
Start the dev server (preview_start) and confirm `/` renders the home page and an unknown path renders the 404 (preview_snapshot on `/` and on `/nope`).

- [ ] **Step 9: Commit**

```
git add motiontimisoaraApp/src
git commit -m "feat(app): app shell with Query + Router providers, home & 404 routes"
```

---

### Task 10: ESLint + Prettier alignment

**Files:**
- Modify/Create: `motiontimisoaraApp/eslint.config.js` (from scaffold), `motiontimisoaraApp/.prettierrc.json`, `motiontimisoaraApp/package.json` (scripts)

- [ ] **Step 1: Install Prettier**

Run: `npm install -D prettier`

- [ ] **Step 2: Add `.prettierrc.json` matching the repo convention**

```json
{ "printWidth": 100, "singleQuote": true, "semi": false }
```

- [ ] **Step 3: Add lint/format scripts to `package.json`**

```json
"lint": "eslint .",
"format": "prettier --write \"src/**/*.{ts,tsx,css}\""
```

- [ ] **Step 4: Run lint + format**

Run: `npm run format`
Run: `npm run lint`
Expected: lint exits 0 (fix any trivial issues the scaffold flags).

- [ ] **Step 5: Commit**

```
git add motiontimisoaraApp
git commit -m "chore(app): add Prettier + lint/format scripts"
```

---

### Task 11: Capacitor wrapper (Android + iOS)

**Files:**
- Create: `motiontimisoaraApp/capacitor.config.ts`, `motiontimisoaraApp/android/`, `motiontimisoaraApp/ios/`
- Modify: `motiontimisoaraApp/package.json` (cap scripts)

- [ ] **Step 1: Install Capacitor CLI + platforms + the planned plugins**

Run:
```
npm install @capacitor/cli @capacitor/android @capacitor/ios @capacitor/app @capacitor/camera @capacitor/geolocation @capacitor/push-notifications @capacitor/status-bar @capacitor/splash-screen
```
(`@capacitor/core` and `@capacitor/preferences` are already installed.)

- [ ] **Step 2: Initialize Capacitor**

Run:
```
npx cap init "Motion Timisoara" com.motiontimisoara.app --web-dir=dist
```
Expected: `capacitor.config.ts` created with `appId: 'com.motiontimisoara.app'`, `webDir: 'dist'`.

- [ ] **Step 3: Build the web app (Capacitor needs `dist/`)**

Run: `npm run build`
Expected: `dist/` exists.

- [ ] **Step 4: Add the Android platform**

Run: `npx cap add android`
Expected: `android/` Gradle project created.

- [ ] **Step 5: Add the iOS platform (Windows: folder created; pod install skipped)**

Run: `npx cap add ios`
Expected: `ios/` folder created. On Windows a CocoaPods warning is expected and acceptable (pods install on Codemagic).

- [ ] **Step 6: Sync web assets into native**

Run: `npx cap sync`
Expected: copies `dist/` into Android (and iOS where possible), updates plugin registration; exit 0 for Android.

- [ ] **Step 7: Add convenience scripts to `package.json`**

```json
"cap:sync": "npm run build && cap sync",
"android": "npm run build && cap sync android && cap open android"
```

- [ ] **Step 8: Commit**

```
git add motiontimisoaraApp
git commit -m "feat(app): add Capacitor wrapper (Android + iOS) + plugins"
```

---

### Task 12: CI skeleton (GitHub Actions) + Codemagic iOS stub

**Files:**
- Create: `.github/workflows/app-ci.yml` (repo root), `motiontimisoaraApp/codemagic.yaml`

- [ ] **Step 1: Add the web CI workflow**

`.github/workflows/app-ci.yml`:
```yaml
name: App CI
on:
  push:
    paths: ['motiontimisoaraApp/**', '.github/workflows/app-ci.yml']
  pull_request:
    paths: ['motiontimisoaraApp/**']
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: motiontimisoaraApp
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: motiontimisoaraApp/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
        env:
          VITE_SUPABASE_URL: https://placeholder.supabase.co
          VITE_SUPABASE_ANON_KEY: placeholder
          VITE_STRIPE_PUBLISHABLE_KEY: pk_test_placeholder
```

- [ ] **Step 2: Add a Codemagic iOS stub**

`motiontimisoaraApp/codemagic.yaml`:
```yaml
workflows:
  ios-build:
    name: iOS Build
    instance_type: mac_mini_m2
    max_build_duration: 60
    environment:
      node: 20
      vars:
        XCODE_WORKSPACE: 'ios/App/App.xcworkspace'
        XCODE_SCHEME: 'App'
    scripts:
      - name: Install dependencies
        script: cd motiontimisoaraApp && npm ci
      - name: Build web + sync iOS
        script: cd motiontimisoaraApp && npm run build && npx cap sync ios
      - name: CocoaPods
        script: cd motiontimisoaraApp/ios/App && pod install
      # Signing + xcodebuild archive added in Phase 10 once an Apple account exists.
```

- [ ] **Step 3: Verify the workflow YAML is valid (syntax check via build locally already covered)**

No local run needed; confirm files exist and are well-formed.

- [ ] **Step 4: Commit**

```
git add .github/workflows/app-ci.yml motiontimisoaraApp/codemagic.yaml
git commit -m "ci(app): add web CI workflow + Codemagic iOS stub"
```

---

### Task 13: Phase-1 acceptance check

**Files:** none (verification only)

- [ ] **Step 1: Full local gate**

Run (from `motiontimisoaraApp/`):
```
npm run typecheck
npm run lint
npm test
npm run build
```
Expected: all exit 0.

- [ ] **Step 2: Native sync gate**

Run: `npx cap sync android`
Expected: exit 0 (assets copied, plugins registered).

- [ ] **Step 3: Update the plan index**

Mark Phase 1 status **Done** in `docs/superpowers/plans/2026-06-15-rebuild-plan-index.md`.

- [ ] **Step 4: Commit the status update**

```
git add docs/superpowers/plans/2026-06-15-rebuild-plan-index.md
git commit -m "docs: mark Phase 1 (Foundation) complete"
```

---

## Self-Review (against the spec)

- **§3 Tech Stack** → Tasks 1–11 install/configure every listed library. ✓
- **§4 Repo layout** → `motiontimisoaraApp/` with `src/lib`, `src/routes`, `src/features`, `src/components/ui` established (full feature subdirs grow in later phases). ✓
- **§5 Data layer** → typed Supabase client (Task 8), money helpers (Task 6); `api/`+`hooks/` are populated per-feature in Phases 4–8 (not Phase 1). ✓
- **§6 Auth/routing** → router + guards: router shell here (Task 9); AuthProvider + guards are **Phase 3** (out of Phase 1 scope by design). ✓
- **§7 Design system** → Tailwind + shadcn initialized (Tasks 2–3); full tokens/components are **Phase 2**. ✓
- **§10 Capacitor** → wrapper + all planned plugins installed (Tasks 8, 11); native feature wiring is Phases 9–10. ✓
- **§12 Testing/CI** → Vitest+RTL (Task 5) + CI (Task 12). ✓
- **Placeholder scan:** `database.types.ts` is an intentional, documented stub (regenerated Phase 4); `.env` holds placeholder values by design until the live project exists. No undefined references. ✓
- **Type consistency:** `Database` export name stable across Tasks 8; `isNative()` used consistently (Tasks 7, 8). ✓
