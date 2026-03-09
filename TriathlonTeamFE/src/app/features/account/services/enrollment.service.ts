import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BillingDetailsRequest {
  name: string;
  email: string;
  addressLine1: string;
  city: string;
  postalCode: string;
}

export interface EnrollmentRequest {
  kind: 'COURSE' | 'CAMP' | 'ACTIVITY';
  entityId: string;
  childIds: string[];
  paymentMethod: 'CARD' | 'CASH';
  sessionPackageSize?: number;
  billingDetails?: BillingDetailsRequest;
}

export interface Enrollment {
  id: string;
  status: string;
}

export interface EnrollmentCreateResponse {
  enrollmentId: string;
  requiresPaymentIntent: boolean;
}

export type EnrollmentKind = 'course' | 'camp' | 'activity';
export type EnrollmentStatus = 'active' | 'pending' | 'completed' | 'cancelled';
export type PaymentStatus = 'completed' | 'pending' | 'partial' | 'failed' | 'refunded';

export interface ParentEnrollmentListItem {
  id: string;
  childId: string;
  childName: string;
  title: string;
  period?: string;
  kind: EnrollmentKind;
  location?: string;
  nextOccurrence?: string;
  status: EnrollmentStatus;
  statusLabel: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentStatus?: PaymentStatus;
  paymentStatusLabel?: string;
  paymentMethod?: 'CARD' | 'CASH';
  paymentCreatedAt?: string;
  paymentPaidAt?: string;
  invoiceUrl?: string;
  invoiceId?: string;
  purchasedSessions?: number;
  remainingSessions?: number;
  sessionsUsed?: number;
}

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);

  createEnrollment(payload: EnrollmentRequest): Observable<EnrollmentCreateResponse> {
    return this.http.post<EnrollmentCreateResponse>('/api/enrollments', payload);
  }

  cancelDraftEnrollment(enrollmentId: string): Observable<void> {
    return this.http.post<void>(`/api/enrollments/${enrollmentId}/cancel-draft`, {});
  }

  myEnrollments(): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>('/api/enrollments/me');
  }

  getEnrollments(): Observable<ParentEnrollmentListItem[]> {
    return this.http.get<any[]>('/api/parent/enrollments').pipe(
      map((items) => {
        const mapped = (items ?? [])
          .map((item) => this.mapParentEnrollment(item))
          .filter((enrollment) => {
            // Filter out enrollments with missing childId to prevent matching issues
            if (!enrollment.childId) {
              console.error('Enrollment missing childId - data integrity issue:', enrollment);
              return false;
            }
            return true;
          });

        const sorted = [...mapped].sort((a, b) => {
          const aDate = a.paymentCreatedAt ?? a.paymentPaidAt ?? '';
          const bDate = b.paymentCreatedAt ?? b.paymentPaidAt ?? '';
          return (bDate || '').localeCompare(aDate || '');
        });

        const seenKeys = new Set<string>();
        const deduped: ParentEnrollmentListItem[] = [];

        for (const enrollment of sorted) {
          const key = `${enrollment.childId}|${enrollment.title}|${enrollment.period ?? ''}`;
          if (seenKeys.has(key)) {
            continue;
          }
          seenKeys.add(key);
          deduped.push(enrollment);
        }

        return deduped;
      })
    );
  }

  private mapParentEnrollment(raw: any): ParentEnrollmentListItem {
    const payment = raw.payment ?? raw.lastPayment ?? {};
    const invoice = raw.invoice ?? {};
    const normalizedStatus = this.normalizeEnrollmentStatus(raw.status);
    const normalizedKind = this.normalizeKind(raw.kind ?? raw.type);
    const normalizedPaymentStatus = this.normalizePaymentStatus(payment.status ?? raw.paymentStatus);

    const invoiceUrl = this.resolveInvoiceUrl({
      url: invoice.url ?? raw.invoiceUrl,
      id: invoice.id ?? raw.invoiceId ?? payment.invoiceId
    });

    // Extract childId - critical for matching enrollments to children
    const childId = raw.child?.id ?? raw.childId;
    if (!childId) {
      console.warn('Enrollment data missing child information:', { enrollmentId: raw.id, raw });
    }

    return {
      id: String(raw.id ?? payment.id ?? this.generateId()),
      childId: childId != null ? String(childId) : '',
      childName: raw.childName ?? raw.child?.name ?? 'Copil',
      title: raw.title ?? raw.entity?.name ?? raw.activityName ?? raw.courseName ?? raw.campName ?? 'Activitate',
      period: raw.period ?? raw.schedule ?? raw.occursOn ?? raw.dateRange ?? undefined,
      kind: normalizedKind,
      location: raw.location ?? raw.venue ?? raw.facility ?? undefined,
      nextOccurrence: this.resolveDate(raw.nextOccurrence ?? raw.nextSession ?? raw.startsAt ?? raw.startDate),
      status: normalizedStatus,
      statusLabel: this.enrollmentStatusLabel(normalizedStatus),
      paymentAmount: payment.amount ?? raw.paymentAmount ?? undefined,
      paymentCurrency: payment.currency ?? raw.paymentCurrency ?? 'RON',
      paymentStatus: normalizedPaymentStatus,
      paymentStatusLabel: this.paymentStatusLabel(normalizedPaymentStatus),
      paymentMethod: this.normalizePaymentMethod(payment.method ?? raw.paymentMethod),
      paymentCreatedAt: this.resolveDate(payment.createdAt ?? raw.paymentCreatedAt),
      paymentPaidAt: this.resolveDate(payment.paidAt ?? raw.paymentPaidAt),
      invoiceUrl,
      invoiceId: invoiceUrl ? String(invoice.id ?? raw.invoiceId ?? payment.invoiceId) : undefined,
      purchasedSessions: raw.purchasedSessions ?? undefined,
      remainingSessions: raw.remainingSessions ?? undefined,
      sessionsUsed: raw.sessionsUsed ?? undefined
    };
  }

  private normalizeKind(kind: any): EnrollmentKind {
    const value = String(kind ?? 'course').toLowerCase();
    if (value === 'camp') return 'camp';
    if (value === 'activity') return 'activity';
    return 'course';
  }

  private normalizeEnrollmentStatus(status: any): EnrollmentStatus {
    const value = String(status ?? 'active').toLowerCase();
    switch (value) {
      case 'pending':
        return 'pending';
      case 'completed':
      case 'finished':
        return 'completed';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'active';
    }
  }

  private normalizePaymentStatus(status: any): PaymentStatus | undefined {
    if (!status) return undefined;
    const normalized = String(status).toLowerCase();
    switch (normalized) {
      case 'pending':
        return 'pending';
      case 'partial':
        return 'partial';
      case 'failed':
        return 'failed';
      case 'refunded':
        return 'refunded';
      case 'completed':
      case 'succeeded':
      case 'success':
        return 'completed';
      default:
        return undefined;
    }
  }

  private normalizePaymentMethod(method: any): 'CARD' | 'CASH' | undefined {
    if (!method) return undefined;
    const normalized = String(method).toUpperCase();
    return normalized === 'CASH' ? 'CASH' : normalized === 'CARD' ? 'CARD' : undefined;
  }

  private enrollmentStatusLabel(status: EnrollmentStatus): string {
    switch (status) {
      case 'pending':
        return 'In curs';
      case 'completed':
        return 'Finalizat';
      case 'cancelled':
        return 'Anulat';
      default:
        return 'Activ';
    }
  }

  private paymentStatusLabel(status?: PaymentStatus): string | undefined {
    if (!status) {
      return undefined;
    }

    switch (status) {
      case 'completed':
        return 'Platita';
      case 'pending':
        return 'In asteptare';
      case 'partial':
        return 'Partial';
      case 'failed':
        return 'Esuata';
      case 'refunded':
        return 'Returnata';
      default:
        return undefined;
    }
  }

  private resolveInvoiceUrl(params: { url?: string; id?: string }): string | undefined {
    if (params.url) {
      return String(params.url);
    }

    if (params.id) {
      return '/api/invoices/' + params.id;
    }

    return undefined;
  }

  private resolveDate(value: any): string | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2, 10);
  }
}

