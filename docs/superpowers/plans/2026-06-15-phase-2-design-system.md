# Phase 2 — Design System Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed inline in autonomous mode with browser verification (preview on port 3007).

**Goal:** Establish the "Sportiv energic" visual language (tokens, typography), the shared UI primitives, the public app chrome (CoreLayout + Header + Footer + FabAccount), and a redesigned Home page — so every later screen is built on a consistent, modern, branded foundation.

**Direction:** Deep azure/teal **primary** + warm energetic **highlight** (orange), cool neutrals, rounded cards, soft shadows; Inter (body) + Sora (display headings). Clean, dynamic, credible for a kids' multi-sport club.

**Tech:** Tailwind v4 tokens (oklch), shadcn/ui primitives (authored manually — CLI hangs), @fontsource self-hosted fonts (Capacitor-friendly), lucide-react icons.

> **Scope note:** data-bound shared components (Calendar, LocationPicker, MapView, VideoEmbed) are built in their feature phases (4–8) where their data shape is known. Phase 2 delivers tokens, typography, presentational primitives, the public chrome, and a Home redesign as proof of the language.

---

### Task 1: Brand tokens ("Sportiv energic" palette)
**Files:** Modify `src/index.css`
- [ ] Replace the neutral oklch palette with the branded one (azure/teal primary, warm `--highlight`, `--success`, cool neutrals), light + dark; add `--color-highlight*`, `--color-success*`, `--font-sans`, `--font-display` to `@theme inline`.
- [ ] Verify build + screenshot the home page (button should turn azure).

### Task 2: Typography (Inter + Sora, self-hosted)
**Files:** `src/index.css`, `src/main.tsx`, `package.json`
- [ ] Install `@fontsource-variable/inter @fontsource-variable/sora`.
- [ ] Import fonts in `main.tsx`; wire `--font-sans`/`--font-display` and a base `font-sans`; headings use `font-display`.
- [ ] Verify build + screenshot.

### Task 3: Core shadcn primitives (manual)
**Files:** `src/components/ui/{card,badge,avatar,input,label,dropdown-menu,sheet,sonner,skeleton,separator}.tsx`; deps
- [ ] Install radix deps: `@radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-separator @radix-ui/react-label` + `sonner`.
- [ ] Author each primitive (canonical shadcn new-york, theme-token based).
- [ ] Typecheck + lint.

### Task 4: Custom presentational components
**Files:** `src/components/{StarRating,ImageWithFallback,ScrollReveal,Logo}.tsx` + tests for StarRating
- [ ] StarRating (half-star, readonly + interactive) + test.
- [ ] ImageWithFallback (src → fallback on error).
- [ ] ScrollReveal (IntersectionObserver, respects reduced-motion).
- [ ] Logo (brand wordmark/mark).
- [ ] Test + typecheck.

### Task 5: Public app chrome
**Files:** `src/layout/{CoreLayout,Header,Footer,FabAccount}.tsx`; modify `src/routes/{router,RootLayout}.tsx`
- [ ] Header: brand logo, public nav (Cursuri/Activități/Tabere/Hartă/Antrenori/Cluburi/Despre/Contact), responsive mobile drawer (sheet), auth-aware area (login/register buttons; later avatar menu). Use placeholder auth state (Phase 3 wires real auth).
- [ ] Footer: brand, contact, link groups (Navigare/Programe/Legal/Social), copyright.
- [ ] FabAccount: floating action (hidden until auth; placeholder for now).
- [ ] CoreLayout = Header + Outlet + Footer (+ Fab). Mount under RootLayout for public routes.
- [ ] Verify nav + responsive (screenshot desktop + mobile width).

### Task 6: Home page redesign (proof of language)
**Files:** `src/features/public/HomePage.tsx` + section components under `src/features/public/home/`
- [ ] Hero (headline, subcopy, primary + highlight CTAs), value props row, "programs" placeholder grid (static cards until Phase 4 wires Supabase), coaches strip placeholder, CTA band.
- [ ] Verify with screenshots (desktop + mobile).

### Task 7: Component gallery (dev reference) + acceptance
**Files:** `src/features/dev/UiGalleryPage.tsx`; route `/dev/ui`
- [ ] Gallery showcasing buttons (all variants), badges, cards, inputs, avatar, star rating, toasts, skeleton.
- [ ] Full gate: typecheck + lint + test + build + `cap sync android`.
- [ ] Screenshot gallery; mark Phase 2 done in plan index; commit.
