# Feature #278 implementation plan

1. Reuse the existing active-location API and implement precise 50 metre proximity
   filtering in a focused helper under the club location-form feature folder.
2. Add a coordinate-keyed query hook and canonical nearby-location panel below
   the existing picker. Keep loading, failed-with-retry, empty and populated
   outcomes separate.
3. Connect an explicit source/new-place choice to the creation form, preserve
   exact coordinates and current-club ownership, and cancel pending reverse
   lookup when choosing an existing source. Preserve the edit flow.
4. Add focused boundary, ownership, choice and race regression tests alongside
   the existing form tests. Remove comments from changed authored files.
5. Run targeted tests when dependencies are available. The main session performs
   installation and full checks, browser verification, review, Git delivery and
   incremental UI inventory synchronization while preserving human gates.
