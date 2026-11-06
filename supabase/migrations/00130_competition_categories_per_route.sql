ALTER TABLE public.competition_age_categories
    DROP CONSTRAINT competition_age_categories_no_overlap;

SET search_path = public, extensions, pg_catalog;

ALTER TABLE public.competition_age_categories
    ADD CONSTRAINT competition_age_categories_no_overlap EXCLUDE USING gist (
        competition_id WITH =,
        route_id WITH =,
        int4range(age_from, age_to, '[]') WITH &&
    ) DEFERRABLE INITIALLY IMMEDIATE;

RESET search_path;
