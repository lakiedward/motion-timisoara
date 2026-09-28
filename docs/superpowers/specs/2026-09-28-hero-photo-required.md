# Hero photo required

Date: 2026-09-28

The empty hero gradient is not the public hero. An activity, course, camp, and
competition each need a hero photo chosen in the organizer form before save.
The coach or the club sets it. A save with no new file and no stored path
stops and shows `Poza din capul paginii este obligatorie.` The public hero
band renders that photo. It does not render the empty gradient.

The gallery stays a separate set of photos. A gallery image does not fill the
hero band, and removing the hero is not offered. Existing rows that already
have no hero stay readable; their public page simply has no hero band until
the organizer adds the photo on the next save.

Club uploads to `activity-photos` need migration
`00077_club_activity_hero_photo.sql`. That file is not applied by this change.
