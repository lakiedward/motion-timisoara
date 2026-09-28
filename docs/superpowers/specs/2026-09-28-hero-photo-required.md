# Hero photo required

Date: 2026-09-28

The empty hero gradient is not the public hero. An activity, course, camp, and
competition each need a hero photo chosen in the organizer form before save.
The coach or the club sets it. A save with no new file and no stored path
stops and shows `Poza din capul paginii este obligatorie.` The public hero
band renders that photo across the full width, with the title in white on the
photo, the same frame as the course detail. It does not render the empty
gradient, and it does not add the course sport or level chips.

The gallery stays a separate set of photos. A gallery image does not fill the
hero band, and removing the hero is not offered. A row with no stored hero
stays readable; its public page has no hero band until a photo is set.

Club uploads to `activity-photos` need migration
`00077_club_activity_hero_photo.sql`. Applied once on 2026-09-28 as remote
`20260928094434` (`club_activity_hero_photo`).

On the same day, every existing activity, course, and camp that had no hero
received one. Where a gallery photo already existed, that first photo became
the hero and the gallery row stayed. A row with no photo received a new hero
file. No competition rows existed.
