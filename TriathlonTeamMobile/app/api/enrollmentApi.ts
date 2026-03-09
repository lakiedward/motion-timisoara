import { supabase } from '../lib/supabase';
import type { EnrollmentDto } from './parentChildrenApi';

export type PaymentMethod = 'CARD' | 'CASH' | string;

export type EnrollmentCreateResponse = {
  enrollmentId: string;
  requiresPaymentIntent: boolean;
};

export type SessionPurchaseResponse = {
  enrollmentId: string;
  sessionsPurchased: number;
  totalPrice: number;
  newRemainingBalance: number;
  requiresPaymentIntent: boolean;
};

export type PaymentIntentResponse = {
  clientSecret: string;
};

export const listParentEnrollments = async (): Promise<EnrollmentDto[]> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: children } = await supabase
    .from('children')
    .select('id, first_name, last_name')
    .eq('parent_id', user.user.id);

  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);
  const childNameMap = new Map(
    children.map((c) => [c.id, { id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }]),
  );

  const { data, error } = await supabase
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
      payments (id, payment_method, status, amount, created_at, paid_at)
    `)
    .in('child_id', childIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const enrollments: EnrollmentDto[] = [];

  for (const row of data ?? []) {
    const child = childNameMap.get(row.child_id) ?? { id: row.child_id, name: '' };
    const payment = Array.isArray(row.payments) ? row.payments[0] : row.payments;

    // Resolve entity name
    let entity = null;
    if (row.entity_id) {
      const table =
        row.entity_type === 'COURSE'
          ? 'courses'
          : row.entity_type === 'CAMP'
            ? 'camps'
            : 'activities';
      const { data: entityData } = await supabase
        .from(table)
        .select('id, name')
        .eq('id', row.entity_id)
        .single();
      if (entityData) {
        entity = { id: entityData.id, name: entityData.name, type: row.entity_type };
      }
    }

    const sessionsTotal = row.sessions_total ?? 0;
    const sessionsRemaining = row.sessions_remaining ?? 0;

    enrollments.push({
      id: row.id,
      kind: row.entity_type,
      status: row.status,
      child,
      entity,
      payment: payment
        ? {
            id: payment.id,
            method: payment.payment_method ?? '',
            status: payment.status ?? '',
            amount: payment.amount ?? 0,
            createdAt: payment.created_at ?? '',
            paidAt: payment.paid_at ?? null,
          }
        : null,
      createdAt: row.created_at ?? '',
      purchasedSessions: sessionsTotal,
      remainingSessions: sessionsRemaining,
      sessionsUsed: sessionsTotal - sessionsRemaining,
    });
  }

  return enrollments;
};

export const cancelDraftEnrollment = async (enrollmentId: string): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('cancel-draft-enrollment', {
    body: JSON.stringify({ enrollmentId }),
  });

  if (error) throw new Error(error.message ?? 'Failed to cancel draft enrollment');
  if (data?.error) throw new Error(data.error);
};

export const purchaseAdditionalSessions = async (options: {
  enrollmentId: string;
  sessionCount: number;
  paymentMethod: PaymentMethod;
}): Promise<SessionPurchaseResponse> => {
  const { data, error } = await supabase.functions.invoke('purchase-sessions', {
    body: JSON.stringify({
      enrollmentId: options.enrollmentId,
      sessionCount: options.sessionCount,
      paymentMethod: options.paymentMethod,
    }),
  });

  if (error) throw new Error(error.message ?? 'Failed to purchase sessions');
  if (data?.error) throw new Error(data.error);

  return data as SessionPurchaseResponse;
};

export const createPaymentIntent = async (
  enrollmentId: string,
): Promise<PaymentIntentResponse> => {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: JSON.stringify({ enrollmentId }),
  });

  if (error) throw new Error(error.message ?? 'Failed to create payment intent');
  if (data?.error) throw new Error(data.error);

  return data as PaymentIntentResponse;
};
