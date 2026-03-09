import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CoachApiService,
  CoachCourse,
  CoachCourseDetails,
  CoachParticipant,
  CourseAttendancePayload,
  CourseScheduleSlot,
  CreateCoursePayload,
  LocationOption
} from './coach-api.service';

export interface CoachCourseSummary {
  id: string;
  name: string;
  sport?: string;
  level?: string;
  ageRange?: string;
  enrolledCount: number;
  reservedCount?: number;
  enrolledPaidCount?: number;
  enrolledUnpaidCount?: number;
  schedule?: string;
  price?: number;
  coachName?: string;
  location?: string;
  active?: boolean;
  hasHeroPhoto?: boolean;
}

export interface CoachCourseDetail extends CoachCourseSummary {
  capacity?: number;
  location?: string;
  locationId?: string;
  locationName?: string;
  meetingDays?: string[];
  timeRange?: string;
  scheduleSlots: CourseScheduleSlot[];
  ageFrom?: number;
  ageTo?: number;
  description?: string;
}

export interface CoachParticipantView {
  id: string;
  childName: string;
  parentName?: string;
  parentEmail?: string;
  paymentStatus: 'paid' | 'due';
  paymentStatusLabel: string;
  presentToday: boolean;
}

export interface CourseFormPayload {
  name: string;
  sport: string;
  level: string;
  ageFrom: number;
  ageTo: number;
  locationId?: string;
  locationName?: string;
  capacity: number;
  price: number;
  pricePerSession: number;
  packageOptions?: string;
  schedule: CourseScheduleSlot[];
  description?: string;
  // Club and payment settings
  clubId?: string;
  paymentRecipient: 'COACH' | 'CLUB';
}

// Activity interfaces
export interface CoachActivity {
  id: string;
  name: string;
  coachName: string;
  sport: string;
  sportName: string;
  location: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  capacity: number | null;
  active: boolean;
  enrolledCount: number;
  reservedCount: number;
  hasHeroPhoto: boolean;
}

export interface CoachActivityDetail {
  id: string;
  name: string;
  description: string | null;
  coachId: string;
  coachName: string;
  sport: string;
  sportName: string;
  locationId: string;
  locationName: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  capacity: number | null;
  active: boolean;
  hasHeroPhoto: boolean;
  createdAt: string;
}

export interface CoachActivityPayload {
  name: string;
  description?: string | null;
  coachId?: string;
  sport: string;
  locationId: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency?: string;
  capacity?: number | null;
  active?: boolean;
}

export interface ActivityParticipant {
  id: string;
  kind: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  child: {
    id: string;
    name: string;
  };
  entity?: {
    id: string;
    name: string;
    type: string;
  };
  payment?: {
    id: string;
    method: 'CARD' | 'CASH';
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
    amount: number;
    createdAt: string;
    paidAt?: string;
  };
  createdAt: string;
  purchasedSessions: number;
  remainingSessions: number;
  sessionsUsed: number;
}

@Injectable({ providedIn: 'root' })
export class CoachService {
  private readonly api = inject(CoachApiService);
  private readonly http = inject(HttpClient);
  private readonly activitiesUrl = '/api/coach/activities';

  private readonly dayDefinitions: Array<{ key: string; number: number; label: string; aliases: string[] }> = [
    { key: 'monday', number: 1, label: 'Luni', aliases: ['1', '01', 'luni', 'monday', 'mon'] },
    { key: 'tuesday', number: 2, label: 'Marti', aliases: ['2', '02', 'marti', 'tuesday', 'tue'] },
    { key: 'wednesday', number: 3, label: 'Miercuri', aliases: ['3', '03', 'miercuri', 'wednesday', 'wed'] },
    { key: 'thursday', number: 4, label: 'Joi', aliases: ['4', '04', 'joi', 'thursday', 'thu'] },
    { key: 'friday', number: 5, label: 'Vineri', aliases: ['5', '05', 'vineri', 'friday', 'fri'] },
    { key: 'saturday', number: 6, label: 'Sambata', aliases: ['6', '06', 'sambata', 'saturday', 'sat'] },
    { key: 'sunday', number: 7, label: 'Duminica', aliases: ['7', '07', 'duminica', 'sunday', 'sun'] }
  ];

  getMyCourses(): Observable<CoachCourseSummary[]> {
    return this.api.getMyCoursesSummary().pipe(
      map((items) =>
        items.map((item: any) => ({
          id: item.id,
          name: item.name,
          sport: item.sport,
          level: item.level,
          ageRange: this.composeAgeRange({ ageFrom: item.ageFrom, ageTo: item.ageTo }),
          enrolledCount: Number(item.enrolledCount ?? 0),
          reservedCount: Number(item.reservedCount ?? 0),
          enrolledPaidCount: Number(item.enrolledPaidCount ?? 0),
          enrolledUnpaidCount: Number(item.enrolledUnpaidCount ?? 0),
          schedule: undefined,
          price: item.price,
          coachName: item.coachName,
          location: item.location,
          active: item.active,
          hasHeroPhoto: Boolean(item.hasHeroPhoto)
        }))
      )
    );
  }

  getCourseDetails(courseId: string): Observable<CoachCourseDetail> {
    return this.api.getCourse(courseId).pipe(map((course) => this.mapCourseDetail(course)));
  }

  getParticipants(courseId: string): Observable<CoachParticipantView[]> {
    return this.api.getCourseParticipants(courseId).pipe(map((items) => items.map((item) => this.mapParticipant(item))));
  }

  setCourseStatus(courseId: string, active: boolean): Observable<void> {
    return this.api.setCourseStatus(courseId, active);
  }

  deleteCourse(courseId: string): Observable<void> {
    return this.api.deleteCourse(courseId);
  }

  createCourse(payload: CourseFormPayload): Observable<CoachCourseDetail> {
    const apiPayload = this.toApiPayload(payload);
    return this.api.createCourse(apiPayload).pipe(map((course) => this.mapCourseDetail(course)));
  }

  updateCourse(courseId: string, payload: CourseFormPayload): Observable<CoachCourseDetail> {
    const apiPayload = this.toApiPayload(payload);
    return this.api.updateCourse(courseId, apiPayload).pipe(map((course) => this.mapCourseDetail(course)));
  }

  getLocations(): Observable<LocationOption[]> {
    return this.api.getLocations();
  }

  // ========== CLUBS ==========
  getMyClubs(): Observable<import('./coach-api.service').CoachClub[]> {
    return this.api.getMyClubs();
  }

  joinClub(code: string): Observable<import('./coach-api.service').JoinClubResponse> {
    return this.api.joinClub(code);
  }

  leaveClub(clubId: string): Observable<void> {
    return this.api.leaveClub(clubId);
  }

  // ========== ACTIVITIES ==========
  getMyActivities(): Observable<CoachActivity[]> {
    return this.http.get<CoachActivity[]>(this.activitiesUrl);
  }

  getActivityById(activityId: string): Observable<CoachActivityDetail> {
    return this.http.get<CoachActivityDetail>(`${this.activitiesUrl}/${activityId}`);
  }

  createActivity(payload: CoachActivityPayload): Observable<CoachActivityDetail> {
    return this.http.post<CoachActivityDetail>(this.activitiesUrl, payload);
  }

  updateActivity(activityId: string, payload: CoachActivityPayload): Observable<CoachActivityDetail> {
    return this.http.put<CoachActivityDetail>(`${this.activitiesUrl}/${activityId}`, payload);
  }

  setActivityStatus(activityId: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`${this.activitiesUrl}/${activityId}/status`, { active });
  }

  deleteActivity(activityId: string): Observable<void> {
    return this.http.delete<void>(`${this.activitiesUrl}/${activityId}`);
  }

  getActivityHeroPhoto(activityId: string): Observable<{ photo: string | null }> {
    return this.http.get<{ photo: string | null }>(`${this.activitiesUrl}/${activityId}/hero-photo`);
  }

  uploadActivityHeroPhoto(activityId: string, photoBase64: string): Observable<CoachActivityDetail> {
    return this.http.post<CoachActivityDetail>(`${this.activitiesUrl}/${activityId}/hero-photo`, { photo: photoBase64 });
  }

  deleteActivityHeroPhoto(activityId: string): Observable<void> {
    return this.http.delete<void>(`${this.activitiesUrl}/${activityId}/hero-photo`);
  }

  getActivityParticipants(activityId: string): Observable<ActivityParticipant[]> {
    return this.http.get<ActivityParticipant[]>(`${this.activitiesUrl}/${activityId}/participants`);
  }

  confirmActivityCashPayment(activityId: string, paymentId: string): Observable<void> {
    return this.http.post<void>(`${this.activitiesUrl}/${activityId}/payments/${paymentId}/confirm-cash`, {});
  }

  markAttendance(
    courseId: string,
    date: string,
    participants: Array<{ participantId: string; present: boolean }>
  ): Observable<void> {
    const payload: CourseAttendancePayload = {
      courseId,
      date,
      participants
    };
    return this.api.markCourseAttendance(payload);
  }

  exportParticipantsCsv(courseId: string): Observable<Blob> {
    return this.api.exportParticipantsCsv(courseId);
  }

  private mapCourseSummary(item: CoachCourse): CoachCourseSummary {
    return {
      id: item.id,
      name: item.name,
      sport: item.sport,
      level: item.level,
      ageRange: this.composeAgeRange(item),
      enrolledCount: item.enrolledCount ?? 0,
      schedule: item.scheduleSummary,
      price: item.price
    };
  }

  private mapCourseDetail(item: CoachCourseDetails): CoachCourseDetail {
    const scheduleSlots = this.normalizeSchedule(item);

    const slotDayLabels: string[] = scheduleSlots
      .map((slot) => slot.dayLabel ?? this.dayLabel(slot.day))
      .filter((value): value is string => Boolean(value));

    const rawMeetingDays: string[] = Array.isArray(item.meetingDays)
      ? item.meetingDays
          .map((day) => {
            if (typeof day === 'string') {
              return this.dayLabel(day) ?? day;
            }
            return this.dayDefinition(day)?.label ?? '';
          })
          .filter((value): value is string => Boolean(value))
      : [];

    const meetingDaySource = slotDayLabels.length ? slotDayLabels : rawMeetingDays;
    const meetingDays = meetingDaySource.length ? meetingDaySource : undefined;

    const primarySlot = scheduleSlots[0];

    return {
      ...this.mapCourseSummary(item),
      capacity: item.capacity ?? undefined,
      location: item.location ?? undefined,
      locationId: item.locationId ?? undefined,
      meetingDays,
      timeRange: primarySlot
        ? this.composeTimeRange(primarySlot.startTime, primarySlot.endTime)
        : this.composeTimeRange(item.startTime, item.endTime),
      scheduleSlots,
      ageFrom: item.ageFrom,
      ageTo: item.ageTo
    };
  }

  private mapParticipant(item: CoachParticipant): CoachParticipantView {
    const paymentStatus = this.normalizePaymentStatus(item.paymentStatus);
    return {
      id: item.id,
      childName: item.childName ?? 'Participant',
      parentName: item.parentName ?? undefined,
      parentEmail: item.parentEmail ?? undefined,
      paymentStatus,
      paymentStatusLabel: item.paymentStatusLabel ?? (paymentStatus === 'paid' ? 'Platita' : 'Restanta'),
      presentToday: Boolean(item.presentToday)
    };
  }

  private toApiPayload(payload: CourseFormPayload): CreateCoursePayload {
    const locationId = payload.locationId?.trim();
    const recurrenceRule = this.buildRecurrenceRule(payload.schedule);
    const clubId = payload.clubId?.trim();

    return {
      name: payload.name,
      sport: payload.sport,
      level: payload.level,
      ageFrom: payload.ageFrom,
      ageTo: payload.ageTo,
      recurrenceRule: recurrenceRule,
      active: true,
      capacity: payload.capacity,
      price: payload.price,
      pricePerSession: payload.pricePerSession,
      packageOptions: payload.packageOptions || undefined,
      description: payload.description,
      locationId: locationId || undefined,
      clubId: clubId || undefined,
      paymentRecipient: payload.paymentRecipient
    };
  }

  private buildRecurrenceRule(schedule: CourseScheduleSlot[]): string {
    const daySchedules: Record<string, { start: string; end: string }> = {};

    schedule.forEach(slot => {
      if (!slot.startTime || !slot.endTime) {
        return;
      }
      
      const dayNumber = this.dayToNumber(slot.day);
      if (dayNumber) {
        daySchedules[dayNumber.toString()] = {
          start: this.normalizeTime(slot.startTime),
          end: this.normalizeTime(slot.endTime)
        };
      }
    });

    return JSON.stringify({ daySchedules });
  }

  private composeAgeRange(item: { ageFrom?: number; ageTo?: number }): string | undefined {
    if (item.ageFrom == null && item.ageTo == null) {
      return undefined;
    }

    if (item.ageFrom != null && item.ageTo != null) {
      return `${item.ageFrom}-${item.ageTo} ani`;
    }

    if (item.ageFrom != null) {
      return `${item.ageFrom}+ ani`;
    }

    return `pana la ${item.ageTo} ani`;
  }

  private composeTimeRange(start?: string, end?: string): string | undefined {
    const normalizedStart = this.normalizeOptionalTime(start);
    const normalizedEnd = this.normalizeOptionalTime(end);

    if (!normalizedStart && !normalizedEnd) {
      return undefined;
    }

    if (normalizedStart && normalizedEnd) {
      return `${this.formatTime(normalizedStart)} - ${this.formatTime(normalizedEnd)}`;
    }

    return normalizedStart ? this.formatTime(normalizedStart) : this.formatTime(normalizedEnd ?? '');
  }

  private formatTime(value: string): string {
    const date = new Date(`1970-01-01T${value}`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  private normalizePaymentStatus(status?: string): 'paid' | 'due' {
    const normalized = String(status ?? '').toLowerCase();
    if (['paid', 'platit', 'platita', 'completed', 'success'].includes(normalized)) {
      return 'paid';
    }
    return 'due';
  }

  private normalizeSchedule(item: CoachCourseDetails): CourseScheduleSlot[] {
    const slots: CourseScheduleSlot[] = [];

    // Prefer explicit scheduleSlots if provided by the API
    if (Array.isArray(item.scheduleSlots) && item.scheduleSlots.length) {
      item.scheduleSlots.forEach((slot) => {
        const definition = this.dayDefinition(slot.day);
        if (!definition) {
          return;
        }
        slots.push({
          day: definition.key,
          dayLabel: definition.label,
          startTime: this.normalizeTime(slot.startTime ?? item.startTime),
          endTime: this.normalizeOptionalTime(slot.endTime ?? item.endTime)
        });
      });
      return this.sortSlots(slots);
    }

    if (Array.isArray(item.schedule) && item.schedule.length) {
      item.schedule.forEach((slot) => {
        const definition = this.dayDefinition(slot.day);
        if (!definition) {
          return;
        }
        slots.push({
          day: definition.key,
          dayLabel: definition.label,
          startTime: this.normalizeTime(slot.startTime ?? item.startTime),
          endTime: this.normalizeOptionalTime(slot.endTime ?? item.endTime)
        });
      });
      return this.sortSlots(slots);
    }

    // Parse recurrenceRule JSON if present (e.g., { daySchedules: { "1": { start, end }, ... } })
    if (item.recurrenceRule) {
      try {
        const parsed = JSON.parse(item.recurrenceRule as unknown as string);
        const daySchedules = (parsed && (parsed.daySchedules || parsed.daySchedule || parsed.days)) || null;
        if (daySchedules && typeof daySchedules === 'object') {
          Object.keys(daySchedules).forEach((key) => {
            const definition = this.dayDefinition(Number(key));
            if (!definition) {
              return;
            }
            const scheduleForDay = daySchedules[key] as { start?: string; end?: string };
            slots.push({
              day: definition.key,
              dayLabel: definition.label,
              startTime: this.normalizeTime(scheduleForDay?.start ?? item.startTime),
              endTime: this.normalizeOptionalTime(scheduleForDay?.end ?? item.endTime)
            });
          });
          if (slots.length) {
            return this.sortSlots(slots);
          }
        }
      } catch {
        // Ignore malformed recurrenceRule
      }
    }

    if (Array.isArray(item.meetingDays) && item.meetingDays.length) {
      item.meetingDays.forEach((day) => {
        const definition = this.dayDefinition(day);
        if (!definition) {
          return;
        }
        slots.push({
          day: definition.key,
          dayLabel: definition.label,
          startTime: this.normalizeTime(item.startTime),
          endTime: this.normalizeOptionalTime(item.endTime)
        });
      });
      return this.sortSlots(slots);
    }

    if (item.startTime) {
      const definition = this.dayDefinition(item.meetingDays?.[0] ?? 'monday');
      if (definition) {
        slots.push({
          day: definition.key,
          dayLabel: definition.label,
          startTime: this.normalizeTime(item.startTime),
          endTime: this.normalizeOptionalTime(item.endTime)
        });
      }
    }

    return this.sortSlots(slots);
  }

  private sortSlots(slots: CourseScheduleSlot[]): CourseScheduleSlot[] {
    return [...slots].sort((a, b) => this.dayToNumber(a.day) - this.dayToNumber(b.day));
  }

  private normalizeTime(value?: string): string {
    if (!value) {
      return '00:00';
    }
    const parts = value.split(':');
    const hours = parts[0]?.padStart(2, '0') ?? '00';
    const minutes = (parts[1] ?? '00').padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private normalizeOptionalTime(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    return this.normalizeTime(value);
  }

  private dayToNumber(day: string): number {
    return this.dayDefinition(day)?.number ?? 1;
  }

  private dayLabel(day: string | number | undefined): string | undefined {
    return this.dayDefinition(day)?.label;
  }

  private dayDefinition(day: string | number | undefined): { key: string; number: number; label: string } | null {
    if (day == null) {
      return null;
    }
    if (typeof day === 'number') {
      return this.dayDefinitions.find((definition) => definition.number === day) ?? null;
    }
    const normalized = day.toString().trim().toLowerCase();
    return (
      this.dayDefinitions.find(
        (definition) => definition.key === normalized || definition.aliases.includes(normalized)
      ) ?? null
    );
  }
}

