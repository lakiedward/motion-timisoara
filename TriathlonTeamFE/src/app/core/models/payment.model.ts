export interface PaymentReportRow {
  id: string;
  enrollmentId: string;
  childName: string;
  parentName: string;
  productName: string | null;
  kind: 'COURSE' | 'CAMP' | 'ACTIVITY';
  coachName: string | null;
  paymentMethod: 'CASH' | 'CARD';
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  allowMarkCash: boolean;
}
