export type RoleRow = {
  role: string | null;
  enabled: boolean | null;
  deleted_at: string | null;
};

export function activeRole(row: RoleRow | null | undefined): string | null {
  if (!row || row.enabled !== true || row.deleted_at !== null) return null;
  return row.role ?? null;
}
