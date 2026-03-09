import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface AdminCoach {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  sports: string[];
  status: 'INVITED' | 'ACTIVE';
}

export interface InviteCoachPayload {
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  sports: string[];
}

export interface AdminCourseSummary {
  id: string;
  name: string;
  coachId: string;
  coachName: string;
  sport: string;
  level: string;
  scheduleSummary: string;
  capacity: number;
  enrolledCount: number;
}

export interface AdminCampSummary {
  id: string;
  title: string;
  period: string;
  price: number;
  currency: string;
  allowCash: boolean;
}

export interface AdminCampPayload {
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  price: number;
  currency: string;
  allowCash: boolean;
  description?: string;
}

export interface AdminPaymentRow {
  id: string;
  childName: string;
  parentName: string;
  productName: string;
  coachName: string;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  updatedAt: string;
  allowMarkCash: boolean;
}

export interface AdminPaymentFilters {
  kind?: string;
  status?: string;
  method?: string;
  coachId?: string;
  from?: string;
  to?: string;
}

export interface WeeklyOccurrence {
  id: string;
  dayOfWeek: number;
  courseName: string;
  coachName: string;
  startTime: string;
  endTime: string;
}

export interface AttendanceOccurrence {
  occurrenceId: string;
  courseId: string;
  courseName: string;
  startsAt: string;
  endsAt: string;
  children: AttendanceChild[];
}

export interface AttendanceChild {
  childId: string;
  childName: string;
  status: 'PRESENT' | 'ABSENT' | null;
  note?: string;
}

export interface MarkAttendancePayload {
  occurrenceId: string;
  childId: string;
  status: string;
  note?: string;
}

// Weekly Calendar interfaces
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

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly supabase = inject(SupabaseService);

  getCoaches(): Observable<AdminCoach[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('coach_profiles')
          .select(`
            id, bio,
            user:profiles(id, name, email, phone, enabled),
            sports:coach_sports(sport:sports(name))
          `);
        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.user?.name ?? '',
          email: row.user?.email ?? '',
          phone: row.user?.phone ?? undefined,
          bio: row.bio ?? undefined,
          sports: (row.sports ?? []).map((cs: any) => cs.sport?.name ?? ''),
          status: row.user?.enabled ? 'ACTIVE' : 'INVITED',
        })) as AdminCoach[];
      })()
    );
  }

  inviteCoach(payload: InviteCoachPayload): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-invite-coach', payload)
    );
  }

  getCourses(): Observable<AdminCourseSummary[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('courses')
          .select(`
            id, name, level, capacity,
            sport:sports(name),
            coach:coach_profiles(id, user:profiles(name)),
            occurrences:course_occurrences(starts_at, ends_at),
            enrollments:enrollments(id)
          `);
        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          coachId: row.coach?.id ?? '',
          coachName: row.coach?.user?.name ?? '',
          sport: row.sport?.name ?? '',
          level: row.level ?? '',
          scheduleSummary: (row.occurrences ?? [])
            .slice(0, 3)
            .map((o: any) => {
              const dt = new Date(o.starts_at);
              const days = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sa'];
              return `${days[dt.getDay()]} ${o.starts_at?.substring(11, 16) ?? ''}`;
            })
            .join(', '),
          capacity: row.capacity ?? 0,
          enrolledCount: (row.enrollments ?? []).length,
        })) as AdminCourseSummary[];
      })()
    );
  }

  saveCourse(courseId: string | null, payload: Partial<AdminCourseSummary> & { coachId: string }): Observable<AdminCourseSummary> {
    return from(
      this.supabase.invokeFunction<AdminCourseSummary>('admin-save-course', { courseId, ...payload })
    );
  }

  getCamps(): Observable<AdminCampSummary[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('camps')
          .select('*');
        if (error) throw error;

        return (data ?? []).map((camp: any) => ({
          id: camp.id,
          title: camp.title,
          period: `${camp.period_start} - ${camp.period_end}`,
          price: camp.price ?? 0,
          currency: camp.currency ?? 'RON',
          allowCash: Boolean(camp.allow_cash),
        })) as AdminCampSummary[];
      })()
    );
  }

  saveCamp(campId: string | null, payload: AdminCampPayload): Observable<AdminCampSummary> {
    return from(
      (async () => {
        const dbPayload = {
          title: payload.title,
          period_start: payload.startDate,
          period_end: payload.endDate,
          location_text: payload.location,
          price: payload.price,
          currency: payload.currency,
          allow_cash: payload.allowCash,
          description: payload.description,
        };

        let result;
        if (campId) {
          const { data, error } = await this.supabase
            .from('camps')
            .update(dbPayload)
            .eq('id', campId)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await this.supabase
            .from('camps')
            .insert(dbPayload)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }

        return {
          id: result.id,
          title: result.title,
          period: `${result.period_start} - ${result.period_end}`,
          price: result.price ?? 0,
          currency: result.currency ?? 'RON',
          allowCash: Boolean(result.allow_cash),
        } as AdminCampSummary;
      })()
    );
  }

  getPayments(filters: AdminPaymentFilters): Observable<AdminPaymentRow[]> {
    return from(
      this.supabase.invokeFunction<AdminPaymentRow[]>('admin-get-payments', filters)
    );
  }

  exportPaymentsCsv(filters: AdminPaymentFilters): Observable<Blob> {
    return from(
      (async () => {
        const csv = await this.supabase.invokeFunction<string>('admin-export-payments-csv', filters);
        return new Blob([csv], { type: 'text/csv' });
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

  getWeeklySchedule(): Observable<WeeklyOccurrence[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('course_occurrences')
          .select(`
            id, starts_at, ends_at,
            course:courses(
              name,
              coach:coach_profiles(user:profiles(name))
            )
          `);
        if (error) throw error;

        return (data ?? []).map((occ: any) => {
          const dt = new Date(occ.starts_at);
          return {
            id: occ.id,
            dayOfWeek: dt.getDay(),
            courseName: occ.course?.name ?? '',
            coachName: occ.course?.coach?.user?.name ?? '',
            startTime: occ.starts_at?.substring(11, 16) ?? '',
            endTime: occ.ends_at?.substring(11, 16) ?? '',
          };
        }) as WeeklyOccurrence[];
      })()
    );
  }

  getAttendance(date: string, coachId?: string): Observable<AttendanceOccurrence[]> {
    return from(
      this.supabase.invokeFunction<AttendanceOccurrence[]>('admin-get-attendance', { date, coachId })
    );
  }

  markAttendance(payload: MarkAttendancePayload): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-mark-attendance', payload)
    );
  }

  coachMarkCashPaid(paymentId: string): Observable<void> {
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

  // Weekly Calendar methods
  getWeeklyCalendar(weekStart: string, coachId?: string): Observable<WeeklyCalendar> {
    return from(
      this.supabase.invokeFunction<WeeklyCalendar>('admin-weekly-calendar', { weekStart, coachId })
    );
  }

  getSessionAttendance(occurrenceId: string): Observable<SessionAttendance> {
    return from(
      this.supabase.invokeFunction<SessionAttendance>('admin-session-attendance', { occurrenceId })
    );
  }

  markSessionAttendance(occurrenceId: string, items: MarkSessionAttendanceItem[]): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-mark-session-attendance', { occurrenceId, items })
    );
  }

  // Session purchases (CASH) for admin/coach inline actions
  purchaseSessions(enrollmentId: string, payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }): Observable<any> {
    return from(
      this.supabase.invokeFunction('purchase-sessions', {
        enrollmentId,
        sessionCount: payload.numberOfSessions,
        paymentMethod: payload.paymentMethod,
      })
    );
  }
}
