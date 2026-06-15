-- One attendance row per (occurrence, child) so clients can upsert attendance.
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_occurrence_child_unique UNIQUE (occurrence_id, child_id);
