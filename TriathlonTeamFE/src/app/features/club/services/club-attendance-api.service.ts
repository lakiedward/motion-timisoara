import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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
  private readonly http = inject(HttpClient);

  getWeeklyCalendar(weekStart: string): Observable<WeeklyCalendar> {
    return this.http.get<WeeklyCalendar>('/api/club/attendance/weekly', {
      params: { weekStart }
    });
  }

  getSessionAttendance(occurrenceId: string): Observable<SessionAttendance> {
    return this.http.get<SessionAttendance>(`/api/club/attendance/session/${occurrenceId}`);
  }

  markSessionAttendance(occurrenceId: string, items: MarkSessionAttendanceItem[]): Observable<void> {
    return this.http.post<void>(`/api/club/attendance/session/${occurrenceId}/mark`, items);
  }

  // Session purchases (CASH) for club inline actions
  purchaseSessions(
    enrollmentId: string,
    payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }
  ): Observable<any> {
    return this.http.post(`/api/enrollments/${enrollmentId}/purchase-sessions`, {
      sessionCount: payload.numberOfSessions,
      paymentMethod: payload.paymentMethod
    });
  }

  getPendingCashPayments(): Observable<ClubPaymentReportRow[]> {
    const params = new HttpParams().set('status', 'PENDING').set('method', 'CASH');
    return this.http.get<ClubPaymentReportRow[]>(`/api/club/payments`, { params });
  }

  markCashPaid(paymentId: string): Observable<void> {
    return this.http.patch<void>(`/api/club/payments/${paymentId}/mark-cash-paid`, null);
  }
}
