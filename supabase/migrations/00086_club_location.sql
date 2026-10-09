-- ============================================================
-- Sediul clubului: județ și punct pe hartă.
--
-- Profilul clubului primește același selector de adresă ca locațiile:
-- județ, oraș, adresă și un marker pe hartă. Coordonatele nu se arată
-- utilizatorului; ele țin markerul exact unde l-a pus clubul și desenează
-- harta de pe pagina publică a clubului.
--
-- Coloanele sunt opționale și nu schimbă rândurile existente. Punctul e
-- complet sau lipsește cu totul, ca o pereche lat/lng să nu rămână pe jumătate.
--
-- Citirea pe coloane e restrânsă din 00012 (anon) și 00035 (authenticated),
-- deci noile coloane publice se acordă explicit. `my_club()` întoarce rândul
-- întreg și le include fără schimbare.
-- ============================================================

ALTER TABLE public.clubs
    ADD COLUMN county text,
    ADD COLUMN lat double precision,
    ADD COLUMN lng double precision;

ALTER TABLE public.clubs
    ADD CONSTRAINT clubs_point_check CHECK (
        (lat IS NULL) = (lng IS NULL)
        AND (lat IS NULL OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180))
    );

GRANT SELECT (county, lat, lng) ON public.clubs TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
