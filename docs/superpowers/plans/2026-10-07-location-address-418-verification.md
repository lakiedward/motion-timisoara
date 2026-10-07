# Feature 418 verification

## Implemented behavior

County and locality are dependent dropdowns using the official INS SIRUTA S1 2025 catalogue (42 county units, including Bucharest; 13,262 unique names within county). There is one editable address/search combobox. Search selection, map click and marker movement synchronize the address, locality and county; a pending reverse lookup disables save and stale responses are ignored. County/locality can be corrected manually. Club create/edit forms omit Description from both UI and writes, preserving existing stored descriptions.

Migration `00082_location_county.sql` was applied to product project `ehdzafadshbaaghzdzdo` as remote version `20261007115343` (`location_county`). The column is nullable text; existing records and RLS are unchanged. Database types were regenerated from the live project, including the previously applied `admin_stats` RPC.

## Application checks

- `npm run typecheck`: passed.
- `npm run lint`: passed, no lint warnings.
- `npm test`: 175 files / 1,628 tests passed. Earlier failures in a status-selector assertion and a short asynchronous suggestion wait were corrected; the full suite was rerun.
- `npm run build`: passed; existing Capacitor mixed-import and large-chunk warnings remain.
- `npm run conventions` and `git diff --check`: passed. Authored changed source remains within the 600-line ceiling; the large locality catalogue and database declarations are generated artifacts.

## Browser and live persistence

The local app on `http://127.0.0.1:3017` used the authorized saved CLUB identity and live product Supabase. Responsive checks covered 1440×900, 768×1024 and 375×812.

- Changing county resets locality and offers only that county's catalogue (Arad excludes Timișoara); Description is absent and only one address field is present.
- Address suggestions for Piața Victoriei were selectable above the map, with hit-testing confirming the list is not covered by Leaflet.
- Selecting an address populated Timiș/Timișoara/Piața Victoriei. A real mobile map click cleared prior fields while lookup was pending, disabled save, then repopulated those fields and enabled save. A narrowly simulated reverse-lookup failure showed an accessible error and Reîncearcă; after restoring normal fetch, retry populated Timiș/Timișoara/Strada Filaret Barbu 4 and removed the error.
- The disposable location was created through the visible form in Club Audit Motion. SQL readback verified owner/club, county/address and selected coordinates.
- Editing the same row through the visible form selected Primăria Municipiului Arad, persisted Arad/Bulevardul Revoluției 75 and coordinates 46.1753711/21.3192954. A seeded existing description was preserved although hidden.
- The authorized disposable row `48279ef5-f8e0-461c-91fa-c3461b8230cb` was removed after verification. Readback confirmed absence and preserved the three existing reference/audit locations. No payments or messages were made.

Local screenshots are retained in the session artifact folder `location-address-county-2026-10-07`: `edit-desktop.png`, `edit-tablet.png`, `edit-mobile.png`, `map-autofill-mobile.png`, `new-form-final.png`, `reverse-error-retry.png`, `reverse-retry-success.png`. The final create preview remains open for the owner. Development-console history includes an intermediate Vite stylesheet reload error; after the corrected build/reload no new app error was recorded, with the expected Stripe HTTP-development warning remaining.

## Additional location types accepted by the owner

The owner's final response was `1 dar vezi sa ai multe tipuri puse ca sa aibe de unde alege`. The requested extension provides 24 choices in five native option groups: pools/water, courts/tracks, indoor halls, outdoor places and other. A shared catalogue supplies both CLUB and COACH forms and their Romanian list labels. Existing POOL/TRACK/GYM/OTHER values remain valid.

Migration `00083_expand_location_types.sql` was applied as remote version `20261007132208` (`expand_location_types`). A rollback-only database assertion inserted all 24 valid types and confirmed that an invalid type is rejected by `locations_type_check`; no assertion rows remained. Live types were regenerated and compared with the checked-in declarations: the CHECK expansion changes no TypeScript declarations or RLS.

The full typecheck, lint, 175-file/1,628-test suite and build passed again after this extension. Current-session diff review checked catalogue/constraint agreement, retained old values, shared options/labels, unchanged ownership/RLS and removal of superseded label maps; no unresolved actionable finding remains. Review covers the final authored type extension over integrated documentation commit `1ce9f478a987df6a661cfa7eba66c6105dea58b2`.

Visible CLUB create/save produced `TENNIS_COURT` and the label Teren de tenis in the list. Reopening the fixture at 375×812 restored all 24 options and its saved type without horizontal overflow. Changing it to OPEN_WATER through the visible edit form succeeded; SQL readback preserved Arad/Bulevardul Revoluției 75 and coordinates 46.1753711/21.3192954. Disposable row `2e79caec-cc8d-4a29-aff6-95412e4aab9d` was deleted with its exact club/creator/name predicates; readback confirmed zero remaining rows and all three existing reference locations preserved.

The saved COACH identity was verified against its live profile role. Its read-only create form showed the same 24 choices/five groups and selected Teren de padel; responsive checks at 768×1024 and 1440×900 showed no horizontal overflow. After an interrupted browser session, the mobile check was completed in Chrome at measured 375×812: all 24 options rendered, PADEL_COURT selected correctly and document scroll width remained 375px. The earlier mis-sized capture was replaced with this measured mobile capture. No COACH record was submitted. Console logs contained the expected Stripe HTTP-development warning and unrelated extension warnings; no application error was reported.

Additional captures: types-desktop.png, type-saved-list.png, types-mobile-edit.png, types-coach-mobile.png and types-coach-desktop.png. Browser access after the session restart was rejected on the internal data-URL error page. The local server was restarted; following the owner's explicit Chrome selection and supplied public-demo screenshot, the normal HTTP/HTTPS Chrome tabs were used. The blocked internal page was not accessed or modified.

## Remaining gates

Missing-address and stale-response contracts are covered by component/API tests; the failure/retry browser check used an explicitly simulated narrow fetch rejection followed by the live provider retry. A street-less provider response and interrupted stale response were not independently replayed in the final browser session. Browser emulation is not native device proof. The human accepted the final form with the added-type condition, now implemented and verified; no publication/production gate is claimed. Historical UI criteria #493/#494 still include Description and are not silently reclassified as passed for the new scope. Canonical UI Coverage inventory/fingerprints will be synchronized from the merged checkout.
