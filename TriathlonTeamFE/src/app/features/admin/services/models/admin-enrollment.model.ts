export type AdminEnrollmentType = 'COURSE' | 'CAMP';
export type AdminEnrollmentPaymentStatus = 'PAID' | 'UNPAID' | 'PENDING' | 'FAILED' | string;
export type AdminEnrollmentPaymentMethod = 'CARD' | 'CASH' | string;

export interface AdminEnrollment {
  id: string;
  childName: string;
  parentName: string;
  activityName: string;
  type: AdminEnrollmentType;
  coachName?: string | null;
  paymentMethod: AdminEnrollmentPaymentMethod;
  paymentStatus: AdminEnrollmentPaymentStatus;
  allowMarkCash: boolean;
  paymentId?: string;
  paidAt?: string;
  amount?: number;
  currency?: string;
}
