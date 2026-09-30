# Coaches directory — UI sections #641 and #482

## Accepted scope

The owner approved section #482 criteria 1732–1734 and section #641 criteria
1735–1743 on 2026-09-30. Both sections share `/antrenori`, so this change delivers
one coherent page. Preserve the existing `Echipă` eyebrow, `Antrenori` H1, header
layout and coach cards. The subtitle becomes exactly
`Antrenori dedicați sportului și copiilor`.

The card keeps only the photo or initial, public name and sports. Its single link
opens the public profile by user ID. Add a visible `Caută după nume` label and
case-insensitive partial name search, alongside a labeled `Sport` native select
whose default is `Toate sporturile`. Both conditions apply together.

## Data and state behavior

Use the existing typed `getCoaches()` API and filter its public response locally.
Derive deduplicated sport options from the complete response, rather than the
filtered subset, so applying a name search does not remove selected sport options.
Keep the response order; no ranking or private profile fields are introduced.

A successful empty backend response keeps
`Niciun antrenor disponibil momentan.`. A nonempty backend response with no
matches shows `Niciun antrenor nu corespunde căutării și filtrelor.` and
`Resetează filtrele`, which clears both controls. A failed request shows
`Nu am putut încărca antrenorii.` and `Reîncearcă`. Retrying preserves filter
values and restores the matching cards after success. Pending initial requests
and retries after an error show canonical skeletons, never a false empty state.

## Design and accessibility

Reuse Input, Label, Button, Badge and Skeleton. The native select follows the
existing form/select tokens and focus pattern. Keep the responsive card grid and
existing card appearance, adding visible keyboard focus and wrapping for long
names and sport labels. Associate control labels with stable IDs. Preserve a
single H1 and semantic theme tokens in both themes.

Stable identities remain
`motion-react:page:/antrenori:section:lista-antrenori` and
`motion-react:page:/antrenori:section:toata-pagina`.

## Verification boundaries

Focused component tests cover combined filtering, defaults/reset, successful
backend empty versus filtered empty, loading, retry recovery and failed refresh.
The orchestrating session owns browser verification at 375×812, 768×1024 and
1440×900, theme/focus/overflow checks, full required app checks, review, delivery
and tracker synchronization. Responsive browser proof does not establish a
native device release or the human's final production gate.
