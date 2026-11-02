# Course gallery „O zi la curs”

Date: 2026-11-02. Requested by the owner („la cursuri nu avem o galerie ca să vadă părintele cam ce o să facă?”).

## Decisions (owner, decision cards in the project thread)

- Layout B: a mosaic section „O zi la curs” right under the course info band, with one large photo, smaller tiles, a short caption on each photo, a „+N poze” tile and the shared lightbox. Option A (the camp grid) was rejected.
- Children's photos: the uploader ticks a consent box before each upload („Am acordul scris al părinților…”), and the public page shows the note „Poze încărcate de organizator, cu acordul scris al părinților.”. No extra rule about unrecognisable faces.

## Design

- Data: the existing `public.course_photos` table (RLS since 00011, storage policies on `course-photos/{course_id}/` since 00090). Migration `00111_course_photo_captions.sql` adds `caption` (≤ 60 chars), `consent_confirmed_at` and `uploaded_by`. A `BEFORE INSERT` trigger refuses a row without consent (HINT `course_photo_consent_required`) and overwrites both values with the server time and `auth.uid()`. The single legacy row keeps NULL consent; nothing is backfilled.
- Upload: `src/features/course-photos/CoursePhotosSection.tsx` in the coach, club and admin course forms (edit mode only; a new course shows „Salvează cursul…”). Same behaviour as the camp gallery: up to 12 photos, resized before upload, reorder, delete with confirmation, native gallery picker on Capacitor. Caption saves on blur/Enter.
- Public: `src/features/public/courses/CourseGalleryMosaic.tsx`. The lightbox was extracted from `PhotoGallery` into `src/components/photo-gallery/PhotoLightbox.tsx` and now shows the caption; camps, activities and competitions keep the same behaviour. The gallery skips a photo that is also the hero (seed data).
- Consistency: card, heading and spacing follow the „Despre curs” section; tiles reuse the camp gallery radius, focus ring and lightbox; the caption scrim uses `--overlay-scrim` like the course hero.

## Tradeoffs

- The `caption` column is selected by the public course queries, so 00111 must be applied before the frontend is merged.
- Consent is a self-declaration recorded with time and account; the platform does not see the parents' written consent.
