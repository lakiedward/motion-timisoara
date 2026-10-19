ALTER TABLE public.children
  ADD COLUMN medical_notes text,
  ADD COLUMN dietary_restrictions text;

ALTER TABLE public.children
  ADD CONSTRAINT children_medical_notes_length CHECK (char_length(medical_notes) <= 1000),
  ADD CONSTRAINT children_dietary_restrictions_length CHECK (char_length(dietary_restrictions) <= 500);
