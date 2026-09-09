DROP SCHEMA IF EXISTS realtime CASCADE;
CREATE SCHEMA realtime;
CREATE TABLE realtime.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    extension TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    event TEXT NOT NULL,
    private BOOLEAN NOT NULL
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA realtime, auth TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON realtime.messages TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$;
CREATE FUNCTION realtime.topic() RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('realtime.topic', true), '');
$$;
CREATE FUNCTION realtime.send(payload JSONB, event TEXT, topic TEXT, private BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('test.realtime_failure', true) = 'on' THEN
        RAISE EXCEPTION 'Simulated notification failure';
    END IF;
    INSERT INTO realtime.messages(topic, extension, payload, event, private)
        VALUES (topic, 'broadcast', payload, event, private);
END;
$$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;
