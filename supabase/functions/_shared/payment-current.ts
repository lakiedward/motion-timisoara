export const OPEN_PAYMENT_STATUSES = ["PENDING", "FAILED"];

export interface OrderedPayment {
  status: string;
  created_at?: string | null;
}

export function currentPayment<T extends OrderedPayment>(rows: T[]): T | null {
  const open = rows.filter((row) => OPEN_PAYMENT_STATUSES.includes(row.status));
  if (open.length > 1) return null;
  if (open.length === 1) return open[0];
  if (rows.length === 1) return rows[0];
  const dated = rows.filter((row) => row.created_at && !Number.isNaN(Date.parse(row.created_at)));
  if (!rows.length || dated.length !== rows.length) return null;
  return [...dated].sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!))[0];
}
