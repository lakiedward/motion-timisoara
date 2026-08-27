-- Locurile rămase la o tabără, pentru pagina publică.
--
-- Perechea lui `course_spots_remaining`, cu aceeași formă și același motiv:
-- SECURITY DEFINER ca un vizitator să poată afla un singur număr fără să
-- capete drept de citire pe `enrollments`.
--
-- Numără și înscrierile PENDING, nu doar cele ACTIVE: un loc pentru care cineva
-- e în mijlocul plății nu mai e liber. `create-enrollment` face aceeași
-- socoteală când refuză, deci pagina și serverul spun același lucru.
--
-- NULL înseamnă capacitate nelimitată, nu zero locuri — apelantul trebuie să le
-- deosebească.

CREATE OR REPLACE FUNCTION public.camp_spots_remaining(p_camp_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN c.capacity IS NULL THEN NULL
    ELSE GREATEST(
      0,
      c.capacity - COALESCE(
        (
          SELECT count(*)::integer
          FROM public.enrollments e
          WHERE e.kind = 'CAMP'
            AND e.entity_id = c.id
            AND e.status IN ('PENDING', 'ACTIVE')
        ),
        0
      )
    )
  END
  FROM public.camps c
  WHERE c.id = p_camp_id;
$$;

COMMENT ON FUNCTION public.camp_spots_remaining(uuid) IS
    'Locuri ramase la o tabara: capacitate minus inscrierile PENDING si ACTIVE. NULL = capacitate nelimitata.';

REVOKE ALL ON FUNCTION public.camp_spots_remaining(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camp_spots_remaining(uuid) TO anon, authenticated;
