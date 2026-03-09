import { httpClient } from './httpClient';
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
  const response = await httpClient.get<EnrollmentDto[]>('/api/parent/enrollments');
  return response.data;
};

export const cancelDraftEnrollment = async (enrollmentId: string): Promise<void> => {
  await httpClient.post(`/api/enrollments/${enrollmentId}/cancel-draft`);
};

export const purchaseAdditionalSessions = async (options: {
  enrollmentId: string;
  sessionCount: number;
  paymentMethod: PaymentMethod;
}): Promise<SessionPurchaseResponse> => {
  const { enrollmentId, sessionCount, paymentMethod } = options;
  const response = await httpClient.post<SessionPurchaseResponse>(
    `/api/enrollments/${enrollmentId}/purchase-sessions`,
    {
      sessionCount,
      paymentMethod,
    },
  );
  return response.data;
};

export const createPaymentIntent = async (
  enrollmentId: string,
): Promise<PaymentIntentResponse> => {
  const response = await httpClient.post<PaymentIntentResponse>('/api/payments/create-intent', {
    enrollmentId,
  });
  return response.data;
};
