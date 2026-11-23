DO $$
DECLARE
    v_function REGPROCEDURE;
    v_previous REGPROCEDURE;
    v_source TEXT;
    v_source_md5 TEXT;
    v_expected INT;
    v_old TEXT;
    v_new TEXT;
BEGIN
    FOR v_function, v_source_md5, v_expected, v_old, v_new IN
        SELECT signature, source_md5, expected_count, old_text, new_text FROM (VALUES
            (1, 'public.record_attendance_transaction(uuid,jsonb)'::REGPROCEDURE, '131d6f12a57345a8dcc928bc4f479711', 1,
                'clock_timestamp() < v_starts', 'clock_timestamp() < v_starts - INTERVAL ''1 hour'''),
            (2, 'public.entrance_checkin_options(text)'::REGPROCEDURE, '45ddb2175d69e7c15ae49b20e8052dcb', 3,
                'INTERVAL ''15 minutes''', 'INTERVAL ''1 hour'''),
            (3, 'public.entrance_checkin(text,uuid,uuid,uuid)'::REGPROCEDURE, '543f7d470cbe03d7341bec1bb55c32b2', 1,
                'INTERVAL ''15 minutes''', 'INTERVAL ''1 hour'''),
            (4, 'public.record_activity_attendance(uuid,uuid[],text,boolean)'::REGPROCEDURE, 'c036752334b60dfabae21ae85dc450c4', 1,
                'v_date DATE;', 'v_starts TIMESTAMPTZ;'),
            (5, 'public.record_activity_attendance(uuid,uuid[],text,boolean)'::REGPROCEDURE, 'c036752334b60dfabae21ae85dc450c4', 1,
                'SELECT activity_date INTO v_date', 'SELECT (activity_date + start_time) AT TIME ZONE ''Europe/Bucharest'' INTO v_starts'),
            (6, 'public.record_activity_attendance(uuid,uuid[],text,boolean)'::REGPROCEDURE, 'c036752334b60dfabae21ae85dc450c4', 1,
                'v_date > (now() AT TIME ZONE ''Europe/Bucharest'')::DATE',
                'p_status IS NOT NULL AND clock_timestamp() < v_starts - INTERVAL ''1 hour''')
        ) AS replacements(step, signature, source_md5, expected_count, old_text, new_text)
        ORDER BY step
    LOOP
        IF v_previous IS DISTINCT FROM v_function THEN
            IF v_previous IS NOT NULL THEN
                EXECUTE v_source;
            END IF;
            SELECT pg_catalog.pg_get_functiondef(oid) INTO v_source
            FROM pg_catalog.pg_proc
            WHERE oid = v_function AND pg_catalog.md5(prosrc) = v_source_md5;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Unexpected attendance function source for %', v_function;
            END IF;
            v_previous := v_function;
        END IF;
        IF (length(v_source) - length(replace(v_source, v_old, ''))) <> v_expected * length(v_old) THEN
            RAISE EXCEPTION 'Unexpected attendance window definition for %', v_function;
        END IF;
        v_source := replace(v_source, v_old, v_new);
    END LOOP;
    EXECUTE v_source;
END
$$;
