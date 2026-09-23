UPDATE storage.buckets
SET file_size_limit = 12582912
WHERE id = 'competition-routes'
  AND file_size_limit IS DISTINCT FROM 12582912;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id = 'competition-routes'
          AND file_size_limit = 12582912
    ) THEN
        RAISE EXCEPTION 'competition-routes bucket is missing';
    END IF;
END;
$$;
