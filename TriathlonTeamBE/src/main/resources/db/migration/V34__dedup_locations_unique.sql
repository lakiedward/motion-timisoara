-- ============================================
-- V34: Deduplicate Locations & Enforce Uniqueness
-- Prevent duplicate locations based on normalized (city + name + address)
-- ============================================

-- Build mapping of duplicate location IDs -> canonical location ID
CREATE TEMP TABLE tmp_location_dedup (
    duplicate_id UUID PRIMARY KEY,
    canonical_id UUID NOT NULL
);

WITH locations_with_key AS (
    SELECT
        l.id,
        l.is_active,
        l.lat,
        l.lng,
        l.address,
        lower(btrim(regexp_replace(coalesce(l.city, ''), '\s+', ' ', 'g'))) AS city_norm,
        lower(btrim(regexp_replace(l.name, '\s+', ' ', 'g'))) AS name_norm,
        lower(btrim(regexp_replace(coalesce(l.address, ''), '\s+', ' ', 'g'))) AS address_norm
    FROM locations l
),
canonical_per_key AS (
    SELECT DISTINCT ON (city_norm, name_norm, address_norm)
        id AS canonical_id,
        city_norm,
        name_norm,
        address_norm
    FROM locations_with_key
    ORDER BY
        city_norm,
        name_norm,
        address_norm,
        is_active DESC,
        (lat IS NOT NULL) DESC,
        (lng IS NOT NULL) DESC,
        (address IS NOT NULL AND btrim(address) <> '') DESC,
        id
)
INSERT INTO tmp_location_dedup (duplicate_id, canonical_id)
SELECT l.id AS duplicate_id, c.canonical_id
FROM locations_with_key l
JOIN canonical_per_key c
  ON c.city_norm = l.city_norm
 AND c.name_norm = l.name_norm
 AND c.address_norm = l.address_norm
WHERE l.id <> c.canonical_id;

-- Update references in courses
UPDATE courses c
SET location_id = m.canonical_id
FROM tmp_location_dedup m
WHERE c.location_id = m.duplicate_id;

-- Update references in activities
UPDATE activities a
SET location_id = m.canonical_id
FROM tmp_location_dedup m
WHERE a.location_id = m.duplicate_id;

-- Consolidate user_recent_locations after remapping duplicates to canonical IDs
CREATE TEMP TABLE tmp_user_recent_locations_consolidated AS
SELECT
    url.user_id,
    COALESCE(m.canonical_id, url.location_id) AS location_id,
    MAX(url.last_used_at) AS last_used_at,
    SUM(url.use_count) AS use_count
FROM user_recent_locations url
LEFT JOIN tmp_location_dedup m ON url.location_id = m.duplicate_id
GROUP BY url.user_id, COALESCE(m.canonical_id, url.location_id);

TRUNCATE user_recent_locations;

INSERT INTO user_recent_locations (user_id, location_id, last_used_at, use_count)
SELECT user_id, location_id, last_used_at, use_count
FROM tmp_user_recent_locations_consolidated;

-- Delete duplicate locations
DELETE FROM locations l
USING tmp_location_dedup m
WHERE l.id = m.duplicate_id;

-- Enforce uniqueness on normalized key
CREATE UNIQUE INDEX IF NOT EXISTS ux_locations_norm_city_name_address
ON locations (
    lower(btrim(regexp_replace(coalesce(city, ''), '\s+', ' ', 'g'))),
    lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))),
    lower(btrim(regexp_replace(coalesce(address, ''), '\s+', ' ', 'g')))
);
