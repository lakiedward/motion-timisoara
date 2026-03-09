import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin';

  getCoaches(): Observable<AdminCoach[]> {
    return this.http.get<AdminCoach[]>(`${this.baseUrl}/coaches`);
  }

  inviteCoach(payload: InviteCoachPayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/coaches/invite`, payload);
  }

  getCourses(): Observable<AdminCourseSummary[]> {
    return this.http.get<AdminCourseSummary[]>(`${this.baseUrl}/courses`);
  }

  saveCourse(courseId: string | null, payload: Partial<AdminCourseSummary> & { coachId: string }): Observable<AdminCourseSummary> {
    if (courseId) {
      return this.http.put<AdminCourseSummary>(`${this.baseUrl}/courses/${courseId}`, payload);
    }
    return this.http.post<AdminCourseSummary>(`${this.baseUrl}/courses`, payload);
  }

  getCamps(): Observable<AdminCampSummary[]> {
    return this.http.get<AdminCampSummary[]>(`${this.baseUrl}/camps`);
  }

  saveCamp(campId: string | null, payload: AdminCampPayload): Observable<AdminCampSummary> {
    if (campId) {
      return this.http.put<AdminCampSummary>(`${this.baseUrl}/camps/${campId}`, payload);
    }
    return this.http.post<AdminCampSummary>(`${this.baseUrl}/camps`, payload);
  }

  getPayments(filters: AdminPaymentFilters): Observable<AdminPaymentRow[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<AdminPaymentRow[]>(`${this.baseUrl}/payments`, { params });
  }

  exportPaymentsCsv(filters: AdminPaymentFilters): Observable<Blob> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get(`${this.baseUrl}/payments/export.csv`, { params, responseType: 'blob' });
  }

  markCashPaid(paymentId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/payments/${paymentId}/mark-cash-paid`, {});
  }

  getWeeklySchedule(): Observable<WeeklyOccurrence[]> {
    return this.http.get<WeeklyOccurrence[]>(`${this.baseUrl}/schedule/week`);
  }

  getAttendance(date: string, coachId?: string): Observable<AttendanceOccurrence[]> {
    let params = new HttpParams().set('date', date);
    if (coachId) {
      params = params.set('coachId', coachId);
    }
    return this.http.get<AttendanceOccurrence[]>(`${this.baseUrl}/attendance`, { params });
  }

  markAttendance(payload: MarkAttendancePayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/attendance/mark`, payload);
  }

  coachMarkCashPaid(paymentId: string): Observable<void> {
    return this.http.patch<void>(`/api/coach/payments/${paymentId}/mark-cash-paid`, {});
  }

  // Weekly Calendar methods
  getWeeklyCalendar(weekStart: string, coachId?: string): Observable<WeeklyCalendar> {
    let params = new HttpParams().set('weekStart', weekStart);
    if (coachId) {
      params = params.set('coachId', coachId);
    }
    return this.http.get<WeeklyCalendar>(`${this.baseUrl}/attendance/weekly`, { params });
  }

  getSessionAttendance(occurrenceId: string): Observable<SessionAttendance> {
    return this.http.get<SessionAttendance>(`${this.baseUrl}/attendance/session/${occurrenceId}`);
  }

  markSessionAttendance(occurrenceId: string, items: MarkSessionAttendanceItem[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/attendance/session/${occurrenceId}/mark`, items);
  }

  // Session purchases (CASH) for admin/coach inline actions
  purchaseSessions(enrollmentId: string, payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }): Observable<any> {
    return this.http.post(`/api/enrollments/${enrollmentId}/purchase-sessions`, { 
      sessionCount: payload.numberOfSessions, 
      paymentMethod: payload.paymentMethod 
    });
  }
}



