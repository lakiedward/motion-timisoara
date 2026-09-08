# Section #653: reliable location map

The owner approved criteria 1313–1318 in Team Tracker on 2026-09-08. Preserve the existing public map, grouped locations and course/activity popup links. Camp markers remain feature #316.

## Problem and behavior

CARTO now returns visible API KEY REQUIRED watermarks for the current unauthenticated raster URL. Configure the existing Voyager provider through VITE_CARTO_BASEMAP_API_KEY, preserving its appearance and visible CARTO/OpenStreetMap attribution. The key belongs only in local/deployment configuration, never tracked source. Official integration: https://carto.com/basemaps/apikey/.

The three map queries currently discard their loading/error states. Add distinct loading, failed-with-retry and no-mappable-locations states. A failed courses or activities query must never be presented as an empty offer list. Keep data retrieval in the existing API functions.

Handle absent basemap configuration and failed/timed-out tiles with explicit feedback and recovery. Preserve the location markers when the basemap is unavailable. Add descriptive marker names, keyboard-visible focus, usable touch controls and bounded scrollable popup content. Reposition an open popup when the map size changes. Preserve deep links using any row ID within a grouped location.

Wait until both marker and popup are bound before opening a deep link. Escape from popup content closes it and restores focus to the marker. Reserve horizontal space for zoom controls when auto-panning. Use the canonical primary/primary-foreground pair in popup headers for readable contrast in both themes.

The owner requested geographic-neutral page copy: “Descoperă locațiile programelor noastre, oriunde în lume.” This does not expand the section to camp markers or change the initial map center.

## Structure

Keep MapPage as the route shell and data-state boundary. Put map rendering, popup content and location focus behavior in a dedicated public/map folder. Reuse Button, Skeleton, existing tokens, markerIcon and locuri grouping rather than adding UI primitives or changing the grouping algorithm.

## Verification and delivery

Verify the six approved criteria through focused Vitest tests and the real local browser at 1440×900, 768×1024 and 375×812. Use explicitly simulated network failures/empty responses for otherwise inaccessible states; do not modify live product data. Prove valid CARTO tiles only after the owner supplies the key. Run app typecheck, lint, tests and build, review the final diff with Bugbot and merge only after required review and human acceptance. Human gate fields remain untouched by the agent.

## Verified on 2026-09-08

- Local Chrome at all three target sizes rendered authenticated CARTO Voyager tiles without the watermark, including provider attribution. The owner supplied the local key; it is not part of this change.
- Real Stadion Atletism links opened Ciclism juniori and Cros de toamnă. The course location link centered the map and opened the popup.
- Browser-only response simulation grouped two location rows into one marker with two clubs, preserved both offers, and opened the group from its second row ID. A separate simulated location displayed the empty-offer message.
- Browser-only slow/empty responses and separate locations, courses and activities failures showed distinct states. All three failure cases recovered through Reîncearcă.
- Blocking CARTO tile requests showed an explicit basemap failure while preserving markers. Unblocking and Reîncearcă harta restored all visible tiles. Missing configuration was also checked before the owner supplied the key.
- Keyboard Enter, Tab, Escape and arrow-key map movement were exercised. Popup close and zoom controls measure 44 px; mobile popup bounds remain clear of zoom controls. Light/dark themes and viewport resizing were inspected.
- All temporary response overrides, tile blocking and theme changes were removed. The final reload had no application console errors; unrelated browser-extension errors and existing Stripe HTTP-development warnings are excluded.
- App typecheck and lint passed; 61 Vitest files / 599 tests passed. Production build passed with existing bundle-size and Capacitor dynamic-import warnings.

Tracker AI plan: #466, section criteria 1313–1318. Browser screenshots are stored locally under `C:/Users/lakie/.codex/visualizations/2026/09/08/01a080d1-5806-76e3-90be-5beef3d1568d/section-653/`. This is browser-responsive evidence, not a native-device run or a public-domain deployment.
