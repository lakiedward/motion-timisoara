-- Seed the core sports taxonomy (referenced by coach/club/course forms).
INSERT INTO public.sports (code, name) VALUES
  ('inot', 'Înot'),
  ('ciclism', 'Ciclism'),
  ('alergare', 'Alergare'),
  ('triatlon', 'Triatlon'),
  ('atletism', 'Atletism'),
  ('gimnastica', 'Gimnastică')
ON CONFLICT (code) DO NOTHING;
