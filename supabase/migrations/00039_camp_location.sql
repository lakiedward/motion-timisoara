-- Tabăra capătă o locație reală, din `locations`.
--
-- Cerut de proprietar și partener pe 2026-09-02 (funcț. #316): taberele aveau
-- doar `location_text`, text liber, deci nu apăreau pe /harta și nu se puteau
-- lega de un loc pe care clubul îl are deja. Decis în aceeași zi: tabăra alege
-- o locație existentă (a clubului, comună a platformei sau a antrenorului) din
-- același select ca la cursuri; crearea cu pin pe hartă rămâne în formularul
-- de locație, nu se dublează în cel de tabără.
--
-- `location_text` rămâne: e detaliul liber („cabana de lângă pârtie, intrarea
-- din spate") și rezerva taberelor vechi, care nu au încă o locație aleasă.
-- Markerul distinct pe /harta și linkul către hartă de pe /tabere/:slug urmează
-- în pasul următor al #316.

ALTER TABLE public.camps
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.camps.location_id IS
    'Locul taberei, din locations. NULL pentru taberele care au doar location_text. Locatia stearsa lasa tabara fara loc, nu o sterge.';

CREATE INDEX IF NOT EXISTS camps_location_idx ON public.camps (location_id);
