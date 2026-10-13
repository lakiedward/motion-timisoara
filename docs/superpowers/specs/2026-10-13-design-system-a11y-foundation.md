# Design system accessibility foundation

Date: 2026-10-13. Team Tracker bugs #1174, #1178, #1175 (project 16).
Source: Motion Timișoara Design System artifact, version 1791896127-376b
(README "Ce s-a schimbat față de cod", tokens.json).

## Scope

Port the accessibility fixes of the design system into the token sheet and the
shared primitives, so every screen inherits them without per-screen edits.

| Area | Before | After |
|---|---|---|
| `muted-foreground` (light) | `#64748b` | `#475569` |
| `destructive` (light) | `#ef4444` + literal white text | `#dc2626` + `destructive-foreground` (dark: `#0b1220`) |
| `input` border | `rgba(15,23,42,.12)` / dark `rgba(255,255,255,.14)` | `#7b8799` / dark `#5d6b82` |
| `ring` (dark) | `#3b82f6` | `#60a5fa` |
| New tokens | — | `highlight-ink`, `success-ink`, `destructive-foreground`, `touch-target` (44px, Tailwind `*-touch-target`) |
| Focus | `ring/50` box-shadow 3px | solid 2px `outline` in `ring`, offset 2px; global `:focus-visible` default |
| `.btn-cta` | ring box-shadow that did not render | outline focus; `--white` / `--on-brand` modifiers with a white outline; reduced-motion stops the lift |
| `.eyebrow` | `highlight` on light backgrounds | `highlight-ink`; `.eyebrow--on-brand` keeps `highlight` on the gradient |
| `Button` sizes | default 36px, sm 32px, lg 40px, icon 36px | default 44px, sm 36px, lg 48px, icon 44px |
| `Input` | 36px | 44px, hover border `muted-foreground`, invalid border 2px |
| `Skeleton` | `bg-accent` | `foreground` 9%, no pulse under reduced motion |
| `text-success` as text/icon on light | `#22c55e` (2.28:1) | `text-success-ink` |

## Out of scope (follow-ups for section work)

- About 40 screen-level controls still carry `outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]`; they move to the outline focus with their section.
- 232 hand-written `min-h-11` / `min-w-11` values can switch to `touch-target` per section.
- `sport-*` colour tokens and `StatusView` from the design system.
