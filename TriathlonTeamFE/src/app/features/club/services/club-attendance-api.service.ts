import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { PaymentReportRow } from '../../../core/models/payment.model';

// Weekly Calendar interfaces (mirrors backend DTOs)
export interface WeeklyCalendar {
  weekStart: string;
  weekEnd: string;
  coaches: CoachWeek[];
}

export interface CoachWeek {
  coachId: string;
  coachName: string;
  days: DayColumn[];
}

export interface DayColumn {
  date: string;
  dayOfWeek: string;
  sessions: SessionCard[];
}

export interface SessionCard {
  occurrenceId: string;
  courseId: string;
  courseName: string;
  startsAt: string;
  endsAt: string;
  enrolledCount: number;
}

export interface SessionAttendance {
  occurrenceId: string;
  courseName: string;
  startsAt: string;
  children: ChildAttendancePayment[];
}

export interface ChildAttendancePayment {
  enrollmentId: string;
  childId: string;
  childName: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | null;
  remainingSessions: number;
  sessionsUsed: number;
  lowSessionWarning: boolean;
}

export interface MarkSessionAttendanceItem {
  childId: string;
  status: string;
  note?: string;
}

export type ClubPaymentReportRow = PaymentReportRow;

@Injectable({ providedIn: 'root' })
export class ClubAttendanceApiService {
  private readonly supabase = inject(SupabaseService);

  getWeeklyCalendar(weekStart: string): Observable<WeeklyCalendar> {
    return from(
      this.supabase.invokeFunction<WeeklyCalendar>('club-weekly-calendar', { weekStart })
    );
  }

  getSessionAttendance(occurrenceId: string): Observable<SessionAttendance> {
    return from(
      this.supabase.invokeFunction<SessionAttendance>('club-session-attendance', { occurrenceId })
    );
  }

  markSessionAttendance(occurrenceId: string, items: MarkSessionAttendanceItem[]): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('club-mark-session-attendance', { occurrenceId, items })
    );
  }

  // Session purchases (CASH) for club inline actions
  purchaseSessions(
    enrollmentId: string,
    payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }
  ): Observable<any> {
    return from(
      this.supabase.invokeFunction('purchase-sessions', {
        enrollmentId,
        sessionCount: payload.numberOfSessions,
        paymentMethod: payload.paymentMethod,
      })
    );
  }

  getPendingCashPayments(): Observable<ClubPaymentReportRow[]> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        // Get payments for enrollments tied to courses in this club
        const { data: courses } = await this.supabase
          .from('courses')
          .select('id')
          .eq('club_id', club.id);
        const courseIds = (courses ?? []).map((c: any) => c.id);
        if (courseIds.length === 0) return [];

        const { data: enrollments } = await this.supabase
          .from('enrollments')
          .select('id, child_id, entity_id, entity_type')
          .eq('entity_type', 'COURSE')
          .in('entity_id', courseIds);
        const enrollmentIds = (enrollments ?? []).map((e: any) => e.id);
        if (enrollmentIds.length === 0) return [];

        const { data, error } = await this.supabase
          .from('payments')
          .select(`
            *,
            enrollment:enrollments(
              id, child_id, entity_id, entity_type,
              child:children(first_name, last_name, parent:profiles(name)),
              course:courses(name, coach:coach_profiles(user:profiles(name)))
            )
          `)
          .in('enrollment_id', enrollmentIds)
          .eq('status', 'PENDING')
          .eq('payment_method', 'CASH');
        if (error) throw error;

        return (data ?? []).map((p: any) => {
          const enrollment = p.enrollment;
          const child = enrollment?.child;
          return {
            id: p.id,
            enrollmentId: p.enrollment_id,
            childName: child ? `${child.first_name} ${child.last_name}` : '',
            parentName: child?.parent?.name ?? '',
            productName: enrollment?.course?.name ?? null,
            kind: (enrollment?.entity_type ?? 'COURSE') as 'COURSE' | 'CAMP' | 'ACTIVITY',
            coachName: enrollment?.course?.coach?.user?.name ?? null,
            paymentMethod: p.payment_method as 'CASH' | 'CARD',
            status: p.status as 'PENDING' | 'SUCCEEDED' | 'FAILED',
            amount: p.amount ?? 0,
            currency: p.currency ?? 'RON',
            createdAt: p.created_at,
            updatedAt: p.updated_at ?? p.created_at,
            allowMarkCash: p.status === 'PENDING' && p.payment_method === 'CASH',
          };
        });
      })()
    );
  }

  markCashPaid(paymentId: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('payments')
          .update({ status: 'SUCCEEDED', paid_at: new Date().toISOString() })
          .eq('id', paymentId);
        if (error) throw error;
      })()
    );
  }
}
