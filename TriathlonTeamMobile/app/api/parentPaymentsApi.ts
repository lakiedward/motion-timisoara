import { supabase } from '../lib/supabase';

export type ParentEnrollmentDto = {
  id: string;
  title: string;
  period: string | null;
  status: string;
  statusLabel: string;
  childName: string | null;
  nextOccurrence: string | null;
  kind: string;
  location: string | null;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  paymentStatus: string | null;
  paymentStatusLabel: string | null;
  paymentMethod: string | null;
  invoiceUrl: string | null;
  purchasedSessions: number | null;
  remainingSessions: number | null;
  sessionsUsed: number | null;
};

export type ParentPaymentDto = {
  id: string;
  enrollmentId: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  method: string;
  status: string;
  statusLabel: string;
  invoiceUrl: string | null;
};

export type ParentOverviewDto = {
  enrollments: ParentEnrollmentDto[];
  payments: ParentPaymentDto[];
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  REFUNDED: 'Refunded',
};

export const getParentOverview = async (): Promise<ParentOverviewDto> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get children
  const { data: children, error: childError } = await supabase
    .from('children')
    .select('id, first_name, last_name')
    .eq('parent_id', user.user.id);

  if (childError) throw new Error(childError.message);
  if (!children || children.length === 0) return { enrollments: [], payments: [] };

  const childIds = children.map((c) => c.id);
  const childNameMap = new Map(
    children.map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]),
  );

  // Get enrollments with payments
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      child_id,
      entity_type,
      entity_id,
      status,
      payment_method,
      sessions_remaining,
      sessions_total,
      created_at,
      payments (id, amount, currency, status, payment_method, paid_at, created_at)
    `)
    .in('child_id', childIds)
    .order('created_at', { ascending: false });

  if (enrollError) throw new Error(enrollError.message);

  const enrollmentDtos: ParentEnrollmentDto[] = [];
  const paymentDtos: ParentPaymentDto[] = [];

  for (const row of enrollments ?? []) {
    // Resolve entity name
    let entityName = '';
    let locationName: string | null = null;
    if (row.entity_id) {
      const table =
        row.entity_type === 'COURSE'
          ? 'courses'
          : row.entity_type === 'CAMP'
            ? 'camps'
            : 'activities';
      const { data: entity } = await supabase
        .from(table)
        .select('id, name, location_id, locations (name)')
        .eq('id', row.entity_id)
        .single();
      if (entity) {
        entityName = entity.name;
        const loc = entity.locations
          ? Array.isArray(entity.locations)
            ? entity.locations[0]
            : entity.locations
          : null;
        locationName = loc?.name ?? null;
      }
    }

    const sessionsTotal = row.sessions_total ?? 0;
    const sessionsRemaining = row.sessions_remaining ?? 0;
    const sessionsUsed = sessionsTotal - sessionsRemaining;

    const payment = Array.isArray(row.payments) ? row.payments[0] : row.payments;

    enrollmentDtos.push({
      id: row.id,
      title: entityName,
      period: null,
      status: row.status,
      statusLabel: statusLabels[row.status] ?? row.status,
      childName: childNameMap.get(row.child_id) ?? null,
      nextOccurrence: null,
      kind: row.entity_type,
      location: locationName,
      paymentAmount: payment?.amount ?? null,
      paymentCurrency: payment?.currency ?? null,
      paymentStatus: payment?.status ?? null,
      paymentStatusLabel: payment ? (statusLabels[payment.status] ?? payment.status) : null,
      paymentMethod: payment?.payment_method ?? row.payment_method ?? null,
      invoiceUrl: null,
      purchasedSessions: sessionsTotal > 0 ? sessionsTotal : null,
      remainingSessions: sessionsTotal > 0 ? sessionsRemaining : null,
      sessionsUsed: sessionsTotal > 0 ? sessionsUsed : null,
    });

    // Collect payments
    const paymentsList = Array.isArray(row.payments) ? row.payments : row.payments ? [row.payments] : [];
    for (const p of paymentsList) {
      paymentDtos.push({
        id: p.id,
        enrollmentId: row.id,
        description: entityName,
        amount: p.amount ?? 0,
        currency: p.currency ?? 'RON',
        date: p.paid_at ?? p.created_at ?? '',
        method: p.payment_method ?? '',
        status: p.status ?? '',
        statusLabel: statusLabels[p.status] ?? p.status ?? '',
        invoiceUrl: null,
      });
    }
  }

  return { enrollments: enrollmentDtos, payments: paymentDtos };
};

export const getParentPayments = async (limit?: number): Promise<ParentPaymentDto[]> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: children, error: childError } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', user.user.id);

  if (childError) throw new Error(childError.message);
  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);

  // Get enrollments for these children to find payments
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, entity_type, entity_id')
    .in('child_id', childIds);

  if (enrollError) throw new Error(enrollError.message);
  if (!enrollments || enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map((e) => e.id);
  const enrollmentMap = new Map(enrollments.map((e) => [e.id, e]));

  let query = supabase
    .from('payments')
    .select('*')
    .in('enrollment_id', enrollmentIds)
    .order('created_at', { ascending: false });

  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data: payments, error: payError } = await query;
  if (payError) throw new Error(payError.message);

  // Resolve entity names
  const entityNameCache = new Map<string, string>();

  const results: ParentPaymentDto[] = [];
  for (const p of payments ?? []) {
    const enrollment = enrollmentMap.get(p.enrollment_id);
    let description = '';
    if (enrollment?.entity_id) {
      if (entityNameCache.has(enrollment.entity_id)) {
        description = entityNameCache.get(enrollment.entity_id)!;
      } else {
        const table =
          enrollment.entity_type === 'COURSE'
            ? 'courses'
            : enrollment.entity_type === 'CAMP'
              ? 'camps'
              : 'activities';
        const { data: entity } = await supabase
          .from(table)
          .select('name')
          .eq('id', enrollment.entity_id)
          .single();
        description = entity?.name ?? '';
        entityNameCache.set(enrollment.entity_id, description);
      }
    }

    results.push({
      id: p.id,
      enrollmentId: p.enrollment_id,
      description,
      amount: p.amount ?? 0,
      currency: p.currency ?? 'RON',
      date: p.paid_at ?? p.created_at ?? '',
      method: p.payment_method ?? '',
      status: p.status ?? '',
      statusLabel: statusLabels[p.status] ?? p.status ?? '',
      invoiceUrl: null,
    });
  }

  return results;
};
