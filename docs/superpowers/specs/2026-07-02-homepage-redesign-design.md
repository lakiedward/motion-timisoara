# Homepage redesign — "sportiv & energic"

## Context

`HomePage.tsx` (React app, `motiontimisoaraApp/src/features/public/HomePage.tsx`) uses a generic,
"safe" visual pattern: symmetric card grids, icon-in-tinted-box value props, flat pastel overlay on
the hero photo, evenly balanced whitespace. The user found this generic and asked for a drastic
UI/UX improvement.

## Direction (user-approved)

- **Aesthetic**: sportiv & energic — bold typography, real photography used dramatically, diagonal
  section cuts, brand-gradient color blocking. Sports-editorial energy, not "corporate SaaS".
- **Scope**: restyle only. Keep the 5 existing sections (hero, value props, programs, testimonials,
  final CTA) and their real data bindings (`getCourses`, `CourseCard`). No new sections, no content
  restructuring.
- Stay on existing design tokens (`--gradient-primary`, `--highlight` amber, Manrope display / Inter
  body) — the composition and scale change, not the base palette.

## Assets

Six real training photos already exist in `motiontimisoaraApp/public/ui/`. Selected for this redesign:
- `20221013_183129.webp` — indoor pool, dramatic blue lighting, kids at the edge facing camera. New
  hero background (replaces the current `20210713_105231.webp`, which reads as too static/posed for
  a full-bleed diagonal treatment).
- `20210405_152345.webp` — lake/hills landscape with the cycling group. Textured background under
  the final CTA gradient.

## Section-by-section design

1. **Hero** — Full-bleed pool photo. A large diagonal wedge in `--gradient-primary` cuts across from
   bottom-left (via `clip-path`), carrying the eyebrow + oversized headline (`text-7xl`/`8xl`) that
   spans on/off the wedge. Stats (11 ani, 200+ copii, 8 antrenori, 5 sporturi) become a horizontal
   ticker strip along the bottom edge of the hero, separated by oblique dividers, instead of four
   plain columns.
2. **Value props** — Replace the 4 white icon-cards with an editorial numbered list (`01`–`04` in
   large display type instead of icon-in-box), alternating alignment, on a lightly tinted full-width
   band.
3. **Programs** — Keep `CourseCard` unchanged (it already carries real photos/data). Replace the flat
   `bg-muted/40` band with a diagonal-clipped section background and a much larger heading.
4. **Testimonials** — Replace the symmetric 2-card grid with one large "hero" quote (oversized ghost
   quotation mark as a typographic background element) plus a smaller second quote beneath, instead
   of a 50/50 grid.
5. **Final CTA** — Same gradient banner, but with a diagonal clip and the lake/hills photo as a
   low-opacity textured layer under the gradient, plus larger type.

## Constraints / non-goals

- No new routes, no new data fetching — same `getCourses` query, same `CourseCard` component.
- No dependency additions; diagonals via CSS `clip-path` (Tailwind v4 arbitrary-value syntax),
  matching the pattern already used for the map popup's Leaflet chrome (plain CSS file colocated
  next to the component when Tailwind utilities aren't sufficient).
- Must remain responsive (mobile: diagonals soften/flatten, ticker wraps) and respect
  `prefers-reduced-motion` (existing `ScrollReveal` already handles this).

## Verification

Dev server preview (`motion-react`), visual check of all 5 sections at desktop + mobile widths, no
console errors, existing course data still renders via `CourseCard`.
