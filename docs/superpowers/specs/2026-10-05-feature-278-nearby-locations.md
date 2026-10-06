# Feature #278: nearby existing club locations

## Accepted scope

On 2026-08-31 the owner decided that choosing a location owned by another club
creates a separate row for the current club at the source's exact coordinates.
There is no shared canonical-place entity, live data migration or RLS change.
The same copy behavior applies to platform locations. A location already owned
by the current club is offered as an existing club location with an edit link,
avoiding another row for the same club.

## Behavior

The existing club creation form searches after the user places the pin. A small
panel immediately below the existing LocationPicker shows active locations
within 50 metres, ordered by precise distance. The search uses the existing
typed getLocations API and a spherical distance calculation. Coordinates remain
unrounded; the public map's separate grouping contract remains intact.

The panel has distinct loading, error with retry, empty and populated states.
With nearby results, the user chooses an offered location or explicitly chooses
to create a different location. Saving waits for the current search and choice.
An empty successful search permits the existing create action. A failed search
does not masquerade as an empty result or permit silent unchecked creation.

Choosing another club's or a platform's location fills name, type, address,
city and description, moves the pin to the exact source coordinates, and leaves
the ordinary form editable. A new row is created only by the existing Save
action; createClubLocation supplies the current club and authenticated creator.
The source's id, club id and creator are never copied into the save payload.

Each search is keyed by the current coordinates and club, so a response for an
older pin cannot supply the newer pin's candidates. Choosing a source remounts
the picker to cancel any outstanding reverse lookup for the previous pin and
advances a picker revision that rejects callbacks from the retired instance.
A later manual pin change requires a fresh choice for those coordinates.
The edit route keeps its existing behavior and does not run nearby searches.

## Existing UI contract

The existing canonical primitives, semantic colors, type scale and map picker
remain in use. UI Coverage identities read live on 2026-10-05 are:

- #493: motion-react:page:/club/locations/:id/edit:section:toata-pagina
- #494: motion-react:page:/club/locations/new:section:toata-pagina

Both currently carry shipped/liked human verdicts. Shared form changes require
inventory synchronization and human reacceptance; this document does not create
new approved criteria or change human gates.

## Verification boundary

Focused tests cover the distance boundary, missing coordinates, active filtering,
result order, source copying, current-club ownership, stale search and reverse
responses, explicit new creation, failure/retry and edit regressions.
Browser verification must cover creation at 375x812, 768x1024 and 1440x900, all
query states, selection, pin movement, keyboard use, save behavior and console
errors. Intercept saves for simulated browser data; do not create live test rows.
The standard typecheck, lint, tests and build, final review, browser evidence and
human UI gates remain required. No deployment or publication is in this scope.
