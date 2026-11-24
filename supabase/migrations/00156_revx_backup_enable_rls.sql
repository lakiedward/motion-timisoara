DO $$
BEGIN
    IF to_regclass('public.revx_sol_state_backup_20261123') IS NOT NULL THEN
        ALTER TABLE public.revx_sol_state_backup_20261123 ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;
