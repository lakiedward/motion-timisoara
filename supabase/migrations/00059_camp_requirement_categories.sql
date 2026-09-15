BEGIN;

CREATE OR REPLACE FUNCTION private.valid_camp_requirements(p_requirements JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_typeof(p_requirements) = 'array'
       AND NOT EXISTS (
            SELECT
            FROM jsonb_array_elements(p_requirements) AS category(value)
            WHERE jsonb_typeof(category.value) <> 'object'
               OR jsonb_typeof(category.value -> 'name') <> 'string'
               OR btrim(category.value ->> 'name') = ''
               OR jsonb_typeof(category.value -> 'items') <> 'array'
               OR jsonb_array_length(category.value -> 'items') = 0
               OR EXISTS (
                    SELECT
                    FROM jsonb_array_elements(
                        CASE
                            WHEN jsonb_typeof(category.value -> 'items') = 'array'
                                THEN category.value -> 'items'
                            ELSE '[]'::jsonb
                        END
                    ) AS item(value)
                    WHERE jsonb_typeof(item.value) <> 'object'
                       OR jsonb_typeof(item.value -> 'name') <> 'string'
                       OR btrim(item.value ->> 'name') = ''
                       OR jsonb_typeof(item.value -> 'quantity') <> 'number'
                       OR (item.value ->> 'quantity') !~ '^[1-9][0-9]*$'
                )
        );
$$;

WITH transformed AS (
    SELECT
        camps.id,
        jsonb_agg(
            jsonb_build_object('name', btrim(item.value #>> '{}'), 'quantity', 1)
            ORDER BY item.position
        ) FILTER (
            WHERE jsonb_typeof(item.value) = 'string'
              AND btrim(item.value #>> '{}') <> ''
        ) AS items
    FROM public.camps
    LEFT JOIN LATERAL jsonb_array_elements(camps.camp_requirements) WITH ORDINALITY
        AS item(value, position) ON TRUE
    GROUP BY camps.id
)
UPDATE public.camps
SET camp_requirements = CASE
    WHEN transformed.items IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(
        jsonb_build_object('name', 'Necesar pentru tabără', 'items', transformed.items)
    )
END
FROM transformed
WHERE camps.id = transformed.id;

ALTER TABLE public.camps
    DROP CONSTRAINT camps_requirements_array_ck,
    ADD CONSTRAINT camps_requirements_categories_ck
        CHECK (private.valid_camp_requirements(camp_requirements));

COMMIT;
