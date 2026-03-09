import { inject, Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface ParentEnrollment {
  id: string;
  title: string;
  period: string;
  status: 'active' | 'pending' | 'completed';
  statusLabel: string;
  childName?: string;
  nextOccurrence?: string;
  kind: 'course' | 'camp' | 'activity';
  location?: string;
  paymentStatus?: 'completed' | 'pending' | 'partial' | 'failed' | 'refunded';
  paymentMethod?: 'CARD' | 'CASH';
  remainingSessions?: number;
  purchasedSessions?: number;
  sessionsUsed?: number;
}

export interface RecentPayment {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  statusLabel: string;
}

export interface CalendarEvent {
  id: string;
  date: Date;
  type: 'course' | 'camp' | 'activity' | 'attendance';
  title: string;
  location?: string;
  time?: string;
  childName?: string;
}

interface ParentOverviewResponse {
  enrollments: ParentEnrollment[];
  payments: RecentPayment[];
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly supabase = inject(SupabaseService);

  getParentOverview(): Observable<ParentOverviewResponse> {
    return from(this.fetchOverview()).pipe(
      catchError(() => of(this.getMockOverview()))
    );
  }

  getParentEnrollments(): Observable<ParentEnrollment[]> {
    return from(this.fetchEnrollments()).pipe(
      catchError(() => of(this.getMockOverview().enrollments))
    );
  }

  getRecentPayments(): Observable<RecentPayment[]> {
    return from(this.fetchRecentPayments()).pipe(
      catchError(() => of(this.getMockOverview().payments))
    );
  }

  getCalendarEvents(startDate: Date, endDate: Date): Observable<CalendarEvent[]> {
    return from(this.fetchCalendarEvents(startDate, endDate)).pipe(
      catchError(() => of(this.getMockCalendarEvents()))
    );
  }

  getUpcomingEvents(limit: number = 10): Observable<CalendarEvent[]> {
    return from(this.fetchUpcomingEvents(limit)).pipe(
      catchError(() => of(this.getMockCalendarEvents().slice(0, limit)))
    );
  }

  private async fetchOverview(): Promise<ParentOverviewResponse> {
    const [enrollments, payments] = await Promise.all([
      this.fetchEnrollments(),
      this.fetchRecentPayments()
    ]);
    return { enrollments, payments };
  }

  private async fetchEnrollments(): Promise<ParentEnrollment[]> {
    // RLS filters by parent_id automatically
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
          status,
          amount,
          currency,
          payment_method
        ),
        next_occurrence:course_occurrences!entity_id (
          starts_at
        )
      `)
      .in('status', ['ACTIVE', 'PENDING'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => this.mapEnrollmentRow(row));
  }

  private async fetchRecentPayments(): Promise<RecentPayment[]> {
    // RLS filters by parent through enrollment -> child -> parent_id
    const { data, error } = await this.supabase
      .from('payments')
      .select(`
        id,
        amount,
        currency,
        status,
        payment_method,
        paid_at,
        created_at,
        enrollment:enrollments!enrollment_id (
          entity_type,
          entity_id,
          course:courses!entity_id ( name )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data ?? []).map((row: any) => this.mapPaymentRow(row));
  }

  private async fetchCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // Get course occurrences for parent's enrolled courses within the date range
    const { data, error } = await this.supabase
      .from('course_occurrences')
      .select(`
        id,
        starts_at,
        ends_at,
        course:courses!course_id (
          id,
          name,
          location:locations!location_id ( name ),
          enrollments (
            id,
            entity_type,
            status,
            child:children!child_id (
              first_name,
              last_name
            )
          )
        )
      `)
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString())
      .order('starts_at', { ascending: true });

    if (error) throw error;

    return (data ?? [])
      .filter((row: any) => row.course?.enrollments?.length > 0)
      .map((row: any) => this.mapCalendarRow(row));
  }

  private async fetchUpcomingEvents(limit: number): Promise<CalendarEvent[]> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('course_occurrences')
      .select(`
        id,
        starts_at,
        ends_at,
        course:courses!course_id (
          id,
          name,
          location:locations!location_id ( name ),
          enrollments (
            id,
            entity_type,
            status,
            child:children!child_id (
              first_name,
              last_name
            )
          )
        )
      `)
      .gte('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data ?? [])
      .filter((row: any) => row.course?.enrollments?.length > 0)
      .map((row: any) => this.mapCalendarRow(row));
  }

  private mapEnrollmentRow(row: any): ParentEnrollment {
    const child = row.child;
    const childName =
      child && child.first_name ? `${child.first_name} ${child.last_name ?? ''}`.trim() : undefined;
    const course = row.course;
    const latestPayment = Array.isArray(row.payments) ? row.payments[0] : undefined;
    const nextOcc = Array.isArray(row.next_occurrence) ? row.next_occurrence[0] : undefined;
    const kindValue = String(row.entity_type ?? 'COURSE').toLowerCase();
    const normalizedKind: ParentEnrollment['kind'] =
      kindValue === 'camp' ? 'camp' : kindValue === 'activity' ? 'activity' : 'course';
    const normalizedStatus = this.normalizeStatus(row.status);

    return {
      id: String(row.id),
      title: course?.name ?? 'Curs',
      period: 'Nespecificat',
      status: normalizedStatus,
      statusLabel: this.statusLabel(normalizedStatus),
      childName,
      nextOccurrence: nextOcc?.starts_at ? new Date(nextOcc.starts_at).toISOString() : undefined,
      kind: normalizedKind,
      location: course?.location?.name ?? undefined,
      paymentStatus: latestPayment ? this.normalizePaymentStatus(latestPayment.status) : undefined,
      paymentMethod: this.normalizePaymentMethod(latestPayment?.payment_method ?? row.payment_method),
      remainingSessions: this.toNumber(row.sessions_remaining),
      purchasedSessions: this.toNumber(row.sessions_total),
      sessionsUsed:
        row.sessions_total != null && row.sessions_remaining != null
          ? row.sessions_total - row.sessions_remaining
          : undefined
    };
  }

  private mapPaymentRow(row: any): RecentPayment {
    const enrollment = row.enrollment;
    const courseName = enrollment?.course?.name;
    const description = courseName ?? 'Plata';

    return {
      id: String(row.id),
      description,
      amount: Number(row.amount ?? 0),
      currency: row.currency ?? 'RON',
      date: row.paid_at ?? row.created_at ?? new Date().toISOString(),
      status: this.normalizeRecentPaymentStatus(row.status),
      statusLabel: this.paymentStatusLabel(this.normalizeRecentPaymentStatus(row.status))
    };
  }

  private mapCalendarRow(row: any): CalendarEvent {
    const course = row.course;
    const firstEnrollment = Array.isArray(course?.enrollments) ? course.enrollments[0] : undefined;
    const child = firstEnrollment?.child;
    const childName =
      child && child.first_name ? `${child.first_name} ${child.last_name ?? ''}`.trim() : undefined;
    const entityType = String(firstEnrollment?.entity_type ?? 'COURSE').toLowerCase();
    const normalizedType: CalendarEvent['type'] =
      entityType === 'camp' ? 'camp' : entityType === 'activity' ? 'activity' : 'course';
    const startsAt = new Date(row.starts_at);
    const timeStr = `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`;

    return {
      id: String(row.id),
      date: startsAt,
      type: normalizedType,
      title: course?.name ?? 'Eveniment',
      location: course?.location?.name ?? undefined,
      time: timeStr,
      childName
    };
  }

  private normalizeStatus(status: any): ParentEnrollment['status'] {
    const value = String(status ?? 'ACTIVE').toUpperCase();
    if (value === 'PENDING') return 'pending';
    if (value === 'EXPIRED' || value === 'CANCELLED') return 'completed';
    return 'active';
  }

  private statusLabel(status: ParentEnrollment['status']): string {
    switch (status) {
      case 'pending':
        return 'In curs';
      case 'completed':
        return 'finalizat';
      default:
        return 'activ';
    }
  }

  private normalizeRecentPaymentStatus(status: any): RecentPayment['status'] {
    const value = String(status ?? 'SUCCEEDED').toUpperCase();
    if (value === 'PENDING') return 'pending';
    if (value === 'FAILED') return 'failed';
    return 'completed';
  }

  private paymentStatusLabel(status: RecentPayment['status']): string {
    switch (status) {
      case 'pending':
        return 'In curs';
      case 'failed':
        return 'esuat';
      default:
        return 'complet';
    }
  }

  private normalizePaymentStatus(status: any): ParentEnrollment['paymentStatus'] {
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

  private normalizePaymentMethod(method: any): ParentEnrollment['paymentMethod'] {
    if (!method) return undefined;
    const normalized = String(method).toUpperCase();
    return normalized === 'CASH' ? 'CASH' : normalized === 'CARD' ? 'CARD' : undefined;
  }

  private toNumber(value: any): number | undefined {
    if (value == null) return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private getMockOverview(): ParentOverviewResponse {
    const enrollments: ParentEnrollment[] = [
      {
        id: 'enr-1',
        title: 'Curs Inot Avansati',
        period: 'Luni & Miercuri 18:00',
        status: 'active',
        statusLabel: 'activ',
        childName: 'Andrei Pop',
        nextOccurrence: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        kind: 'course',
        location: 'Bazin Olimpic',
        paymentStatus: 'completed',
        paymentMethod: 'CARD',
        purchasedSessions: 10,
        remainingSessions: 8,
        sessionsUsed: 2
      },
      {
        id: 'enr-2',
        title: 'Tabara montana de vara',
        period: '1-7 august 2024',
        status: 'pending',
        statusLabel: 'In curs',
        childName: 'Maria Pop',
        nextOccurrence: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
        kind: 'camp',
        location: 'Piatra Craiului',
        paymentStatus: 'pending',
        paymentMethod: 'CASH'
      }
    ];

    const payments: RecentPayment[] = [
      {
        id: 'pay-1',
        description: 'Curs Inot Avansati',
        amount: 350,
        currency: 'RON',
        date: new Date().toISOString(),
        status: 'completed',
        statusLabel: 'complet'
      },
      {
        id: 'pay-2',
        description: 'Tabara montana de vara',
        amount: 1200,
        currency: 'RON',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        status: 'pending',
        statusLabel: 'In curs'
      }
    ];

    return { enrollments, payments };
  }

  private getMockCalendarEvents(): CalendarEvent[] {
    const today = new Date();
    const events: CalendarEvent[] = [];

    for (let i = 1; i <= 30; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + i);

      if (eventDate.getDay() === 1 || eventDate.getDay() === 3) {
        events.push({
          id: `course-${i}`,
          date: eventDate,
          type: 'course',
          title: 'Curs Inot Avansati',
          location: 'Bazin Olimpic',
          time: '18:00',
          childName: 'Andrei Pop'
        });
      }

      if (eventDate.getDay() === 2 || eventDate.getDay() === 4) {
        events.push({
          id: `course-cycling-${i}`,
          date: eventDate,
          type: 'course',
          title: 'Curs Ciclism',
          location: 'Baza Sportiva',
          time: '17:30',
          childName: 'Maria Pop'
        });
      }
    }

    const campDate = new Date(today);
    campDate.setDate(today.getDate() + 10);
    events.push({
      id: 'camp-1',
      date: campDate,
      type: 'camp',
      title: 'Tabara Montana de Vara',
      location: 'Piatra Craiului',
      time: '09:00',
      childName: 'Maria Pop'
    });

    return events;
  }
}
