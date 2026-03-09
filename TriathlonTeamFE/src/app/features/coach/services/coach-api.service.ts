import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PaymentReportRow } from '../../../core/models/payment.model';

export interface CoachCourse {
  id: string;
  name: string;
  sport: string;
  level: string;
  scheduleSummary: string;
  enrolledCount: number;
  enrolledPaidCount?: number;
  enrolledUnpaidCount?: number;
  weeklyOccurrences?: number;
  ageFrom?: number;
  ageTo?: number;
  price?: number;
  pricePerSession?: number;
  packageOptions?: string;
}

export interface CourseScheduleSlot {
  day: string;
  startTime: string;
  endTime?: string;
  dayLabel?: string;
}

export interface CoachCourseDetails extends CoachCourse {
  capacity?: number;
  location?: string;
  locationId?: string;
  meetingDays?: string[];
  startTime?: string;
  endTime?: string;
  schedule?: CourseScheduleSlot[];
  scheduleSlots?: CourseScheduleSlot[];
  hasHeroPhoto?: boolean;
  recurrenceRule?: string;
  active?: boolean;
  description?: string;
  // Club and payment settings
  clubId?: string;
  clubName?: string;
  paymentRecipient?: 'COACH' | 'CLUB';
}

export interface CoachParticipant {
  id: string;
  childName: string;
  parentName?: string;
  parentEmail?: string;
  paymentStatus?: string;
  paymentStatusLabel?: string;
  presentToday?: boolean;
}

export interface CreateCoursePayload {
  name: string;
  sport: string;
  level: string;
  ageFrom: number;
  ageTo: number;
  locationId?: string;
  capacity: number;
  price: number;
  pricePerSession: number;
  packageOptions?: string;
  recurrenceRule: string;
  active: boolean;
  description?: string;
  heroPhoto?: string;
  // Club and payment settings
  clubId?: string;
  paymentRecipient: 'COACH' | 'CLUB';
}

export interface CoachStatusPayload {
  active: boolean;
}

export interface TodayAttendanceChild {
  id: string;
  name: string;
  present: boolean;
}

export interface TodayAttendanceItem {
  occurrenceId: string;
  courseName: string;
  startTime: string;
  endTime: string;
  children: TodayAttendanceChild[];
}

export interface MarkAttendancePayload {
  occurrenceId: string;
  children: Array<{ childId: string; present: boolean }>;
}

export interface CourseAttendancePayload {
  courseId: string;
  date: string;
  participants: Array<{ participantId: string; present: boolean }>;
}

export interface LocationOption {
  id: string;
  name: string;
  address?: string;
}

// Coach's clubs for payment settings
export interface CoachClub {
  id: string;
  name: string;
  canReceivePayments: boolean;
  stripeConfigured: boolean;
}

export interface JoinClubRequest {
  code: string;
}

export interface JoinClubResponse {
  clubId: string;
  clubName: string;
  message: string;
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

export type CoachPaymentReportRow = PaymentReportRow;

@Injectable({ providedIn: 'root' })
export class CoachApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/coach';
  private readonly apiBase = '/api/coach';

  getMyCourses(): Observable<CoachCourse[]> {
    return this.http.get<CoachCourse[]>(`${this.baseUrl}/courses`);
  }

  getMyCoursesSummary(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/courses/my-summary`);
  }

  getCourse(courseId: string): Observable<CoachCourseDetails> {
    return this.http.get<CoachCourseDetails>(`${this.baseUrl}/courses/${courseId}`);
  }

  getCourseParticipants(courseId: string): Observable<CoachParticipant[]> {
    return this.http.get<CoachParticipant[]>(`${this.baseUrl}/courses/${courseId}/participants`);
  }

  exportParticipantsCsv(courseId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/courses/${courseId}/participants/export`, {
      responseType: 'blob'
    }) as Observable<Blob>;
  }

  createCourse(payload: CreateCoursePayload): Observable<CoachCourseDetails> {
    return this.http.post<CoachCourseDetails>(`${this.baseUrl}/courses`, payload);
  }

  updateCourse(courseId: string, payload: CreateCoursePayload): Observable<CoachCourseDetails> {
    return this.http.put<CoachCourseDetails>(`${this.baseUrl}/courses/${courseId}`, payload);
  }

  setCourseStatus(courseId: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/courses/${courseId}/status`, { active } as CoachStatusPayload);
  }

  deleteCourse(courseId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/courses/${courseId}`);
  }

  // Photos API for coach
  uploadCoursePhoto(courseId: string, photo: string) {
    return this.http.post<{ id: string; displayOrder: number }>(`${this.apiBase}/courses/${courseId}/photos`, { photo });
  }

  getCoursePhotos(courseId: string) {
    return this.http.get<Array<{ id: string; displayOrder: number }>>(`${this.apiBase}/courses/${courseId}/photos`);
  }

  deleteCoursePhoto(courseId: string, photoId: string) {
    return this.http.delete<void>(`${this.apiBase}/courses/${courseId}/photos/${photoId}`);
  }

  getCoursePhotoUrl(courseId: string, photoId: string): string {
    return `${this.apiBase}/courses/${courseId}/photos/${photoId}`;
  }

  getLocations(): Observable<LocationOption[]> {
    return this.http.get<LocationOption[]>(`${this.baseUrl}/locations`);
  }

  getMyClubs(): Observable<CoachClub[]> {
    return this.http.get<CoachClub[]>(`${this.baseUrl}/profile/clubs`);
  }

  joinClub(code: string): Observable<JoinClubResponse> {
    return this.http.post<JoinClubResponse>(`${this.baseUrl}/profile/join-club`, { code });
  }

  leaveClub(clubId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/profile/leave-club/${clubId}`, {});
  }

  getTodayAttendance(): Observable<TodayAttendanceItem[]> {
    return this.http.get<TodayAttendanceItem[]>(`${this.baseUrl}/attendance/today`);
  }

  markAttendance(payload: MarkAttendancePayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/attendance/mark`, payload);
  }

  markCourseAttendance(payload: CourseAttendancePayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/attendance`, payload);
  }

  // Weekly attendance methods - uses /api/admin/attendance but filtered by coach on backend
  getWeeklyCalendar(weekStart: string): Observable<WeeklyCalendar> {
    return this.http.get<WeeklyCalendar>(`/api/admin/attendance/weekly`, {
      params: { weekStart }
    });
  }

  getSessionAttendance(occurrenceId: string): Observable<SessionAttendance> {
    return this.http.get<SessionAttendance>(`/api/admin/attendance/session/${occurrenceId}`);
  }

  markSessionAttendance(occurrenceId: string, items: MarkSessionAttendanceItem[]): Observable<void> {
    return this.http.post<void>(`/api/admin/attendance/session/${occurrenceId}/mark`, items);
  }

  // Session purchases (CASH) for coach inline actions
  purchaseSessions(enrollmentId: string, payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }): Observable<any> {
    return this.http.post(`/api/enrollments/${enrollmentId}/purchase-sessions`, { 
      sessionCount: payload.numberOfSessions, 
      paymentMethod: payload.paymentMethod 
    });
  }

  getPendingCashPayments(): Observable<CoachPaymentReportRow[]> {
    const params = new HttpParams()
      .set('status', 'PENDING')
      .set('method', 'CASH');
    return this.http.get<CoachPaymentReportRow[]>(`/api/coach/payments`, { params });
  }

  markCashPaid(paymentId: string): Observable<void> {
    return this.http.patch<void>(`/api/coach/payments/${paymentId}/mark-cash-paid`, null);
  }
}
