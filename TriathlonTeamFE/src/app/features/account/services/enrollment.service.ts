import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../core/services/supabase.service';

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
  private readonly supabase = inject(SupabaseService);

  createEnrollment(payload: EnrollmentRequest): Observable<EnrollmentCreateResponse> {
    // Complex mutation -> Edge Function
    return from(
      this.supabase.invokeFunction<EnrollmentCreateResponse>('create-enrollment', payload)
    );
  }

  cancelDraftEnrollment(enrollmentId: string): Observable<void> {
    // Complex mutation -> Edge Function
    return from(
      this.supabase.invokeFunction<void>('cancel-draft-enrollment', { enrollmentId })
    );
  }

  myEnrollments(): Observable<Enrollment[]> {
    return from(this.fetchMyEnrollments());
  }

  getEnrollments(): Observable<ParentEnrollmentListItem[]> {
    return from(this.fetchParentEnrollments()).pipe(
      map((items) => {
        const filtered = items.filter((enrollment) => {
          if (!enrollment.childId) {
            console.error('Enrollment missing childId - data integrity issue:', enrollment);
            return false;
          }
          return true;
        });

        const sorted = [...filtered].sort((a, b) => {
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

  // --- Private Supabase operations ---

  private async fetchMyEnrollments(): Promise<Enrollment[]> {
    // RLS filters by parent's children automatically
    const { data, error } = await this.supabase
      .from('enrollments')
      .select('id, status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      status: String(row.status)
    }));
  }

  private async fetchParentEnrollments(): Promise<ParentEnrollmentListItem[]> {
    // RLS ensures only parent's children's enrollments are returned
    const { data, error } = await this.supabase
      .from('enrollments')
      .select(`
        id,
        entity_type,
        entity_id,
        status,
        payment_method,
        sessions_remaining,
        sessions_total,
        created_at,
        child:children!child_id (
          id,
          first_name,
          last_name
        ),
        course:courses!entity_id (
          id,
          name,
          location:locations!location_id ( name )
        ),
        payments (
          id,
          amount,
          currency,
          status,
          payment_method,
          paid_at,
          created_at
        ),
        next_occurrence:course_occurrences!entity_id (
          starts_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => this.mapParentEnrollment(row));
  }

  private mapParentEnrollment(row: any): ParentEnrollmentListItem {
    const child = row.child;
    const childId = child?.id ? String(child.id) : '';
    const childName =
      child && child.first_name
        ? `${child.first_name} ${child.last_name ?? ''}`.trim()
        : 'Copil';
    const course = row.course;
    const latestPayment = Array.isArray(row.payments) && row.payments.length > 0
      ? row.payments.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      : undefined;
    const nextOcc = Array.isArray(row.next_occurrence) ? row.next_occurrence[0] : undefined;

    const normalizedStatus = this.normalizeEnrollmentStatus(row.status);
    const normalizedKind = this.normalizeKind(row.entity_type);
    const normalizedPaymentStatus = latestPayment
      ? this.normalizePaymentStatus(latestPayment.status)
      : undefined;

    if (!childId) {
      console.warn('Enrollment data missing child information:', { enrollmentId: row.id, row });
    }

    return {
      id: String(row.id),
      childId,
      childName,
      title: course?.name ?? 'Activitate',
      period: undefined,
      kind: normalizedKind,
      location: course?.location?.name ?? undefined,
      nextOccurrence: nextOcc?.starts_at
        ? new Date(nextOcc.starts_at).toISOString()
        : undefined,
      status: normalizedStatus,
      statusLabel: this.enrollmentStatusLabel(normalizedStatus),
      paymentAmount: latestPayment?.amount ?? undefined,
      paymentCurrency: latestPayment?.currency ?? 'RON',
      paymentStatus: normalizedPaymentStatus,
      paymentStatusLabel: this.paymentStatusLabel(normalizedPaymentStatus),
      paymentMethod: this.normalizePaymentMethod(
        latestPayment?.payment_method ?? row.payment_method
      ),
      paymentCreatedAt: latestPayment?.created_at
        ? new Date(latestPayment.created_at).toISOString()
        : undefined,
      paymentPaidAt: latestPayment?.paid_at
        ? new Date(latestPayment.paid_at).toISOString()
        : undefined,
      invoiceUrl: undefined,
      invoiceId: undefined,
      purchasedSessions: row.sessions_total ?? undefined,
      remainingSessions: row.sessions_remaining ?? undefined,
      sessionsUsed:
        row.sessions_total != null && row.sessions_remaining != null
          ? row.sessions_total - row.sessions_remaining
          : undefined
    };
  }

  private normalizeKind(kind: any): EnrollmentKind {
    const value = String(kind ?? 'COURSE').toUpperCase();
    if (value === 'CAMP') return 'camp';
    if (value === 'ACTIVITY') return 'activity';
    return 'course';
  }

  private normalizeEnrollmentStatus(status: any): EnrollmentStatus {
    const value = String(status ?? 'ACTIVE').toUpperCase();
    switch (value) {
      case 'PENDING':
        return 'pending';
      case 'EXPIRED':
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'active';
    }
  }

  private normalizePaymentStatus(status: any): PaymentStatus | undefined {
    if (!status) return undefined;
    const normalized = String(status).toUpperCase();
    switch (normalized) {
      case 'PENDING':
        return 'pending';
      case 'FAILED':
        return 'failed';
      case 'SUCCEEDED':
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
    if (!status) return undefined;

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
}
