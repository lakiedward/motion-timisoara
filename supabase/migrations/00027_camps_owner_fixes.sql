-- Trei greșeli din 00025, găsite la revizuirea adversarială din 27.08.
--
-- ============================================================================
-- 1. UPDATE putea da tabăra oricui  (BLOCANT)
-- ============================================================================
--
-- `camps_update` folosea `pot_administra_tabara(id)` și în USING, și în WITH CHECK.
-- Funcția e STABLE și își face propriul SELECT din `camps` după `id` — iar `id` nu
-- se schimbă la un UPDATE. Deci WITH CHECK vedea rândul VECHI, era identic cu
-- USING, și nu valida NICIODATĂ proprietarul nou.
--
-- Reprodus în ambele sensuri: un antrenor își muta tabăra pe orice club din
-- sistem, un club o expedia pe user_id-ul oricărui antrenor. `camps_owner_ck`
-- trecea, fiindcă rămânea exact un proprietar — doar că altcineva. Victima
-- pierdea accesul definitiv, iar pagina publică arăta drept organizator pe cineva
-- care nu consimțise niciodată.
--
-- WITH CHECK trebuie să se uite la COLOANELE rândului nou, cum face `camps_insert`
-- și cum face de mult `courses_update`. Un transfer cere acum să deții și vechiul
-- proprietar (USING), și pe cel nou (WITH CHECK).

DROP POLICY IF EXISTS "camps_update" ON public.camps;
CREATE POLICY "camps_update" ON public.camps
    FOR UPDATE TO authenticated
    USING (public.pot_administra_tabara(id))
    WITH CHECK (
        club_id IN (SELECT my_club_ids())
        OR coach_id = (SELECT auth.uid())
        OR (SELECT get_my_role()) = 'ADMIN'
    );

-- ============================================================================
-- 2. Taberele vechi erau înghețate, nu „editabile doar de ADMIN"
-- ============================================================================
--
-- Comentariul din 00025 promitea că cele două tabere fără proprietar rămân „exact
-- comportamentul de azi". Era fals: `NOT VALID` scutește doar validarea rândurilor
-- EXISTENTE la crearea constrângerii; orice UPDATE ulterior reverifică rândul, iar
-- unul fără proprietar pică cu 23514. Nici măcar un ADMIN nu le mai putea corecta.
--
-- Aceeași constrângere bloca și ștergerea unui antrenor: `coach_id` are
-- ON DELETE SET NULL, iar rândul rezultat, fără proprietar, era respins — deci
-- cascada auth.users → profiles → camps eșua, și contul nu se putea șterge.
--
-- Regula corectă e „niciodată DOI stăpâni". „Cel puțin unul" se cere la creare,
-- unde îi e locul: `camps_insert` deja o face, pe coloane.

ALTER TABLE public.camps DROP CONSTRAINT IF EXISTS camps_owner_ck;
ALTER TABLE public.camps
    ADD CONSTRAINT camps_owner_ck
    CHECK (num_nonnulls(club_id, coach_id) <= 1);

COMMENT ON CONSTRAINT camps_owner_ck ON public.camps IS
    'O tabara nu poate avea doi stapani. Cerinta „cel putin unul" se aplica la creare, prin camps_insert — altfel taberele vechi fara proprietar ar deveni needitabile, iar stergerea unui antrenor ar esua.';

-- ============================================================================
-- 3. Bucketul redevenise listabil
-- ============================================================================
--
-- Migrarea 00012, secțiunea C, a scos dinadins politicile `*_public_read` de pe
-- `storage.objects` pentru toate bucketurile publice: un bucket public își
-- servește fișierele prin `/object/public/...` fără nicio politică, iar politica
-- de SELECT nu adăuga acces la fișiere — adăuga doar putința de a LISTA bucketul.
-- `camp_photos_public_read` reintroducea exact ce se scosese, deci oricine putea
-- cere inventarul pozelor, inclusiv al celor încărcate și nepublicate încă.

DROP POLICY IF EXISTS "camp_photos_public_read" ON storage.objects;
