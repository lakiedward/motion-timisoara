import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../core/services/supabase.service';
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
  private readonly supabase = inject(SupabaseService);

  /**
   * Get all courses owned by the current coach.
   * RLS ensures only courses where coach_id matches the auth user are returned.
   */
  getMyCourses(): Observable<CoachCourse[]> {
    return from(
      this.supabase
        .from('courses')
        .select(
          `
          id, name, level, age_from, age_to, price, price_per_session, package_options,
          recurrence_rule, active,
          sport:sports(name),
          enrollments(id, status)
        `
        )
        .eq('active', true)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => this.mapCourseRow(row));
        })
    );
  }

  getMyCoursesSummary(): Observable<any[]> {
    return from(
      this.supabase
        .from('courses')
        .select(
          `
          id, name, level, age_from, age_to, price, price_per_session,
          recurrence_rule, active, hero_photo_storage_path,
          sport:sports(name),
          location:locations(name),
          enrollments(id, status)
        `
        )
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => ({
            id: row.id,
            name: row.name,
            sport: row.sport?.name ?? '',
            level: row.level,
            ageFrom: row.age_from,
            ageTo: row.age_to,
            enrolledCount: (row.enrollments ?? []).filter(
              (e: any) => e.status === 'ACTIVE' || e.status === 'PENDING'
            ).length,
            reservedCount: (row.enrollments ?? []).filter((e: any) => e.status === 'PENDING')
              .length,
            enrolledPaidCount: (row.enrollments ?? []).filter((e: any) => e.status === 'ACTIVE')
              .length,
            enrolledUnpaidCount: (row.enrollments ?? []).filter((e: any) => e.status === 'PENDING')
              .length,
            price: row.price,
            location: row.location?.name ?? '',
            active: row.active,
            hasHeroPhoto: Boolean(row.hero_photo_storage_path),
          }));
        })
    );
  }

  getCourse(courseId: string): Observable<CoachCourseDetails> {
    return from(
      this.supabase
        .from('courses')
        .select(
          `
          id, name, level, age_from, age_to, capacity, price, price_per_session,
          package_options, recurrence_rule, duration_minutes, active, description,
          hero_photo_storage_path, club_id,
          sport:sports(name),
          location:locations(id, name),
          club:clubs(id, name),
          enrollments(id, status)
        `
        )
        .eq('id', courseId)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return this.mapCourseDetails(data);
        })
    );
  }

  getCourseParticipants(courseId: string): Observable<CoachParticipant[]> {
    return from(
      this.supabase
        .from('enrollments')
        .select(
          `
          id, status,
          child:children(id, first_name, last_name,
            parent:users(id, first_name, last_name, email)
          ),
          payments(status)
        `
        )
        .eq('entity_id', courseId)
        .eq('entity_type', 'COURSE')
        .in('status', ['ACTIVE', 'PENDING'])
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => {
            const child = row.child;
            const parent = child?.parent;
            const latestPayment = (row.payments ?? [])[0];
            return {
              id: row.id,
              childName: child
                ? `${child.first_name} ${child.last_name}`
                : 'Participant',
              parentName: parent
                ? `${parent.first_name} ${parent.last_name}`
                : undefined,
              parentEmail: parent?.email ?? undefined,
              paymentStatus: latestPayment?.status ?? 'PENDING',
              paymentStatusLabel:
                latestPayment?.status === 'SUCCEEDED' ? 'Platita' : 'Restanta',
              presentToday: false,
            } as CoachParticipant;
          });
        })
    );
  }

  exportParticipantsCsv(courseId: string): Observable<Blob> {
    return from(
      this.supabase
        .invokeFunction<string>('export-participants-csv', { courseId })
        .then((csvString) => new Blob([csvString], { type: 'text/csv' }))
    );
  }

  createCourse(payload: CreateCoursePayload): Observable<CoachCourseDetails> {
    return from(
      this.supabase
        .invokeFunction<any>('create-course', payload)
        .then((data) => this.mapCourseDetails(data))
    );
  }

  updateCourse(
    courseId: string,
    payload: CreateCoursePayload
  ): Observable<CoachCourseDetails> {
    return from(
      this.supabase
        .invokeFunction<any>('update-course', { courseId, ...payload })
        .then((data) => this.mapCourseDetails(data))
    );
  }

  setCourseStatus(courseId: string, active: boolean): Observable<void> {
    return from(
      this.supabase
        .from('courses')
        .update({ active })
        .eq('id', courseId)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  deleteCourse(courseId: string): Observable<void> {
    return from(
      this.supabase
        .invokeFunction<void>('delete-course', { courseId })
    );
  }

  // Photos API for coach
  uploadCoursePhoto(
    courseId: string,
    photo: string
  ): Observable<{ id: string; displayOrder: number }> {
    return from(
      this.supabase
        .invokeFunction<{ id: string; displayOrder: number }>('upload-course-photo', {
          courseId,
          photo,
        })
    );
  }

  getCoursePhotos(
    courseId: string
  ): Observable<Array<{ id: string; displayOrder: number }>> {
    return from(
      this.supabase
        .from('course_photos')
        .select('id, display_order')
        .eq('course_id', courseId)
        .order('display_order', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => ({
            id: row.id,
            displayOrder: row.display_order,
          }));
        })
    );
  }

  deleteCoursePhoto(courseId: string, photoId: string): Observable<void> {
    return from(
      this.supabase
        .invokeFunction<void>('delete-course-photo', { courseId, photoId })
    );
  }

  getCoursePhotoUrl(courseId: string, photoId: string): string {
    // Build a presigned URL from Supabase storage
    const { data } = this.supabase
      .storage('course-photos')
      .getPublicUrl(`${courseId}/${photoId}`);
    return data?.publicUrl ?? '';
  }

  getLocations(): Observable<LocationOption[]> {
    return from(
      this.supabase
        .from('locations')
        .select('id, name, address')
        .eq('active', true)
        .order('name', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as LocationOption[];
        })
    );
  }

  getMyClubs(): Observable<CoachClub[]> {
    return from(
      this.supabase
        .from('coach_profiles')
        .select(
          `
          clubs:club_coaches(
            club:clubs(id, name, stripe_account_id, stripe_onboarding_complete)
          )
        `
        )
        .then(({ data, error }) => {
          if (error) throw error;
          const profile = (data ?? [])[0];
          if (!profile) return [];
          return ((profile as any).clubs ?? []).map((cc: any) => {
            const club = cc.club;
            return {
              id: club.id,
              name: club.name,
              canReceivePayments: Boolean(club.stripe_onboarding_complete),
              stripeConfigured: Boolean(club.stripe_account_id),
            } as CoachClub;
          });
        })
    );
  }

  joinClub(code: string): Observable<JoinClubResponse> {
    return from(
      this.supabase.invokeFunction<JoinClubResponse>('join-club', { code })
    );
  }

  leaveClub(clubId: string): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('leave-club', { clubId })
    );
  }

  getTodayAttendance(): Observable<TodayAttendanceItem[]> {
    return from(
      this.supabase.invokeFunction<TodayAttendanceItem[]>('get-today-attendance', {})
    );
  }

  markAttendance(payload: MarkAttendancePayload): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('mark-attendance', payload)
    );
  }

  markCourseAttendance(payload: CourseAttendancePayload): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('mark-course-attendance', payload)
    );
  }

  // Weekly attendance methods
  getWeeklyCalendar(weekStart: string): Observable<WeeklyCalendar> {
    return from(
      this.supabase.invokeFunction<WeeklyCalendar>('get-weekly-calendar', {
        weekStart,
      })
    );
  }

  getSessionAttendance(occurrenceId: string): Observable<SessionAttendance> {
    return from(
      this.supabase.invokeFunction<SessionAttendance>('get-session-attendance', {
        occurrenceId,
      })
    );
  }

  markSessionAttendance(
    occurrenceId: string,
    items: MarkSessionAttendanceItem[]
  ): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('mark-session-attendance', {
        occurrenceId,
        items,
      })
    );
  }

  // Session purchases (CASH) for coach inline actions
  purchaseSessions(
    enrollmentId: string,
    payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }
  ): Observable<any> {
    return from(
      this.supabase.invokeFunction<any>('purchase-sessions', {
        enrollmentId,
        sessionCount: payload.numberOfSessions,
        paymentMethod: payload.paymentMethod,
      })
    );
  }

  getPendingCashPayments(): Observable<CoachPaymentReportRow[]> {
    return from(
      this.supabase
        .from('payments')
        .select(
          `
          id, amount, currency, status, payment_method, created_at, updated_at,
          enrollment:enrollments(
            id, entity_type,
            child:children(first_name, last_name,
              parent:users(first_name, last_name)
            ),
            course:courses(name,
              coach:coach_profiles(
                user:users(first_name, last_name)
              )
            )
          )
        `
        )
        .eq('status', 'PENDING')
        .eq('payment_method', 'CASH')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => {
            const enrollment = row.enrollment;
            const child = enrollment?.child;
            const parent = child?.parent;
            const course = enrollment?.course;
            const coach = course?.coach?.user;
            return {
              id: row.id,
              enrollmentId: enrollment?.id ?? '',
              childName: child
                ? `${child.first_name} ${child.last_name}`
                : '',
              parentName: parent
                ? `${parent.first_name} ${parent.last_name}`
                : '',
              productName: course?.name ?? null,
              kind: (enrollment?.entity_type ?? 'COURSE') as
                | 'COURSE'
                | 'CAMP'
                | 'ACTIVITY',
              coachName: coach
                ? `${coach.first_name} ${coach.last_name}`
                : null,
              paymentMethod: row.payment_method as 'CASH' | 'CARD',
              status: row.status as 'PENDING' | 'SUCCEEDED' | 'FAILED',
              amount: row.amount,
              currency: row.currency,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              allowMarkCash:
                row.status === 'PENDING' && row.payment_method === 'CASH',
            } as CoachPaymentReportRow;
          });
        })
    );
  }

  markCashPaid(paymentId: string): Observable<void> {
    return from(
      this.supabase
        .from('payments')
        .update({ status: 'SUCCEEDED', paid_at: new Date().toISOString() })
        .eq('id', paymentId)
        .eq('payment_method', 'CASH')
        .eq('status', 'PENDING')
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  // ---- Private helpers ----

  private mapCourseRow(row: any): CoachCourse {
    const enrollments = row.enrollments ?? [];
    const activeEnrollments = enrollments.filter(
      (e: any) => e.status === 'ACTIVE' || e.status === 'PENDING'
    );
    return {
      id: row.id,
      name: row.name,
      sport: row.sport?.name ?? '',
      level: row.level ?? '',
      scheduleSummary: '',
      enrolledCount: activeEnrollments.length,
      enrolledPaidCount: enrollments.filter((e: any) => e.status === 'ACTIVE').length,
      enrolledUnpaidCount: enrollments.filter((e: any) => e.status === 'PENDING').length,
      ageFrom: row.age_from,
      ageTo: row.age_to,
      price: row.price,
      pricePerSession: row.price_per_session,
      packageOptions: row.package_options,
    };
  }

  private mapCourseDetails(row: any): CoachCourseDetails {
    if (!row) {
      throw new Error('Course not found');
    }

    const enrollments = row.enrollments ?? [];
    const activeEnrollments = enrollments.filter(
      (e: any) => e.status === 'ACTIVE' || e.status === 'PENDING'
    );

    let recurrenceRule = row.recurrence_rule ?? row.recurrenceRule;
    let scheduleSlots: CourseScheduleSlot[] | undefined;

    // Parse recurrence_rule to extract schedule slots
    if (recurrenceRule) {
      try {
        const parsed =
          typeof recurrenceRule === 'string'
            ? JSON.parse(recurrenceRule)
            : recurrenceRule;
        const daySchedules =
          parsed?.daySchedules || parsed?.daySchedule || parsed?.days;
        if (daySchedules && typeof daySchedules === 'object') {
          scheduleSlots = Object.keys(daySchedules).map((key) => {
            const sched = daySchedules[key];
            return {
              day: key,
              startTime: sched?.start ?? '',
              endTime: sched?.end ?? undefined,
            };
          });
        }
      } catch {
        // Ignore malformed JSON
      }
    }

    return {
      id: row.id,
      name: row.name,
      sport: row.sport?.name ?? '',
      level: row.level ?? '',
      scheduleSummary: '',
      enrolledCount: activeEnrollments.length,
      enrolledPaidCount: enrollments.filter((e: any) => e.status === 'ACTIVE').length,
      enrolledUnpaidCount: enrollments.filter((e: any) => e.status === 'PENDING').length,
      ageFrom: row.age_from ?? row.ageFrom,
      ageTo: row.age_to ?? row.ageTo,
      capacity: row.capacity,
      price: row.price,
      pricePerSession: row.price_per_session ?? row.pricePerSession,
      packageOptions: row.package_options ?? row.packageOptions,
      location: row.location?.name ?? row.locationName ?? undefined,
      locationId: row.location?.id ?? row.locationId ?? undefined,
      hasHeroPhoto: Boolean(
        row.hero_photo_storage_path ?? row.heroPhotoStoragePath ?? row.hasHeroPhoto
      ),
      recurrenceRule:
        typeof recurrenceRule === 'string'
          ? recurrenceRule
          : recurrenceRule
            ? JSON.stringify(recurrenceRule)
            : undefined,
      scheduleSlots,
      active: row.active,
      description: row.description,
      clubId: row.club_id ?? row.club?.id ?? row.clubId ?? undefined,
      clubName: row.club?.name ?? row.clubName ?? undefined,
      paymentRecipient: row.payment_recipient ?? row.paymentRecipient ?? undefined,
    };
  }
}
