import { httpClient } from './httpClient';

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

export const getParentOverview = async (): Promise<ParentOverviewDto> => {
  const response = await httpClient.get<ParentOverviewDto>('/api/parent/overview');
  return response.data;
};

export const getParentPayments = async (limit?: number): Promise<ParentPaymentDto[]> => {
  const params: Record<string, number> = {};
  if (limit && limit > 0) {
    params.limit = limit;
  }
  const response = await httpClient.get<ParentPaymentDto[]>('/api/parent/payments', {
    params,
  });
  return response.data;
};
