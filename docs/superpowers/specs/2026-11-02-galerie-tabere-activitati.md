# Galerie ca la cursuri pentru tabere și activități

Data: 2026-11-02. Cerere: proprietarul a ales „Tabere + activități” după auditul galeriilor (`/mnt/project-files/verificari/galerii/audit-galerii-2026-11-02.md`).

## Decizie

- Taberele și activitățile primesc aceeași galerie ca la cursuri (#631): mozaic public cu descrieri scurte, nota de acord al părinților și, în formular, descriere ≤ 60 de caractere pe poză și bifa obligatorie „Am acordul scris al părinților…”.
- Titluri publice: „O zi la curs”, „O zi la tabără”, „Din activitate”.
- Un singur cod pentru toate trei: `src/api/photo-gallery.ts` (citire, urcare, descriere, ștergere, ordine, galeria publică), `src/features/photo-gallery/` (editorul din formular) și `src/components/photo-gallery/PhotoMosaic.tsx` (mozaicul public). `PhotoGallery` rămâne pentru traseele de concurs.

## Bază de date (migrația 00112)

- `camp_photos`: `caption`, `consent_confirmed_at`, `uploaded_by` și trigger de acord la INSERT, ca la `course_photos` în 00111. Rândurile vechi rămân cu acord NULL.
- `activity_photos`: tabel nou, UUID, `timestamptz`, FK cu `ON DELETE CASCADE` spre activitate și `SET NULL` spre profil, RLS: citire după vizibilitatea activității, scriere prin `pot_administra_activitate`. Fișierele stau în `activity-photos/{activity_id}/gallery/`, acoperit deja de politicile de storage din 00090.

## Compromisuri

- Între aplicarea migrației și următoarea publicare, producția veche nu poate adăuga poze noi în galeria taberelor (trimite rânduri fără acord, iar trigger-ul le refuză). Site-ul public și pozele existente nu sunt afectate.
- Activitatea nu mai repetă poza sportului în galerie; activitatea demo păstrează poza de previzualizare doar cât nu are poze reale.
- Fișierele galeriei unei activități șterse rămân în bucket, ca poza hero de azi (curățenia nocturnă acoperă doar taberele).
