# Public pages consistency (TT bugs #1314–#1318)

Audit on master 5a2140c: `/mnt/project-files/verificari/consistenta/public/raport.md`. Owner approved fixing all five (card tap, 2026-11-02 16:35Z).

- #1314: one `OfferCard` (aspect-video photo, sport badge, 18/600 title, icon meta list, price + "Detalii") for courses, activities, camps and competitions; one `OFFER_GRID` (1/2/3 columns); one `PublicPageHeader` (48px on desktop) for the six list pages.
- #1315: clubs get name search, sport filter, result count and filtered-empty state; coaches get the count; shared `SearchField` with label, icon and placeholder; "Oriunde" everywhere. Camps and competitions have no sport in the schema, so they keep no sport filter (needs a schema decision).
- #1316: competition detail uses the two-column layout with `InfoBand` and a side enroll card ("Înscrie-te"); public competition dates use the short numeric format; course organizer uses `OrganizerCoaches`; course and camp show the location map when coordinates exist; camp CTA is full width; activity hero shows the sport badge; the facts band stacks on phones.
- #1317: shared `DetailBackLink`; club detail uses the coach profile card layout and max-w-6xl; both offer sections are titled "Cursuri, tabere și activități"; club cards follow the coach card layout.
- #1318: footer link groups use two columns on phones.

Tradeoff: camp cards no longer show the green "Înscrieri deschise" badge; like the other offers, only a full offer gets a status badge.
