ALTER TABLE public.children
  ADD COLUMN photo_consent boolean,
  ADD COLUMN pickup_persons text,
  ADD COLUMN swim_level text;

ALTER TABLE public.children
  ADD CONSTRAINT children_swim_level_check CHECK (swim_level IN ('no', 'basic', 'yes')),
  ADD CONSTRAINT children_pickup_persons_length CHECK (char_length(pickup_persons) <= 500);
