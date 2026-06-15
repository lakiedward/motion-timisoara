-- ============================================================
-- Demo seed data for local/testing (idempotent-ish; run once on a fresh DB).
-- Creates locations, courses (+ occurrences), activities and camps owned by a
-- COACH profile. Replace the coach_id below with a real coach profile id.
-- Sports are seeded by migration 00007.
-- ============================================================
-- NOTE: set this to an existing COACH profile id before running on a fresh DB.
-- \set coach_id '00000000-0000-0000-0000-000000000000'

INSERT INTO public.locations (name, type, address, city, lat, lng, is_active) VALUES
 ('Bazin Olimpic Timișoara','POOL','Str. Înotului 1','Timișoara',45.7489,21.2087,true),
 ('Stadion Atletism','TRACK','Str. Sportului 5','Timișoara',45.7600,21.2300,true),
 ('Sala Polivalentă','GYM','Bd. Take Ionescu 10','Timișoara',45.7570,21.2250,true);

-- Courses / occurrences / activities / camps: see chat history for the full
-- INSERT statements (parametrised by the coach profile id). Camps need no coach.
INSERT INTO public.camps (title, slug, description, period_start, period_end, location_text, capacity, price, allow_cash, gallery_json) VALUES
 ('Tabără de vară multi-sport', 'tabara-vara-2026', 'O săptămână de sport, joacă și prietenii noi în natură.', (now() + interval '60 day')::date, (now() + interval '67 day')::date, 'Poiana Brașov', 30, 150000, true, '[]'),
 ('Tabără de înot', 'tabara-inot-2026', 'Stagiu intensiv de înot pentru juniori.', (now() + interval '90 day')::date, (now() + interval '95 day')::date, 'Timișoara', 20, 90000, false, '[]')
ON CONFLICT (slug) DO NOTHING;
