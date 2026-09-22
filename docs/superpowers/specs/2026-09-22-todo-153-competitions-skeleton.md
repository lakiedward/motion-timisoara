# To-Do #153 — competitions skeleton

Accepted by the owner on 2026-09-22 from the grouped questions (choices 1A–5A).
Section 6 (age brackets, closing, podium, GPX) stays out of this slice.

## Behavior

- Public list `/concursuri` and detail `/concursuri/:slug`.
- Club, coach, and admin list, create, and edit at `/club/competitions`,
  `/coach/competitions`, and `/admin/competitions`, beside Tabere.
- Fields: title (required, 1–120), description (required, 1–4000), optional hero
  image. No date, place, capacity, sport, price, route, or rules file.
- A saved competition is public immediately. There is no draft flag.
- The public navigation, footer, and club/coach/admin menus gain Concursuri
  next to Tabere. The native five-tab bar is unchanged; the new entry is in
  Explorează and in the role menus.
- Ownership matches camps: a club or a coach owns the row, never both. An admin
  may create a row with no owner and can read and change every row.
- The slug is generated from the title and stays stable when the title changes.
  A taken slug gets a short suffix from the row id.
- The hero uses the public bucket `competition-photos`, path
  `{id}/hero/{uuid}.jpg`, the same image check and resize as camp heroes.
  The bucket is not listable. The same screens render in the browser and in
  the Capacitor app. Native gallery pick is used only inside the app; the web
  file input stays on the web.
- The owner or an admin can delete a competition from the edit screen so a
  mistaken skeleton can be removed. The hero file is removed first, while the
  row still exists, because the storage policy checks `pot_administra_concurs`.
  Deleting a club cascades. Deleting a coach clears `coach_id` and leaves the
  public row for an admin.

## Not in this slice

GPX routes, age categories, enrollment, payments, coach assignment, and podium.
