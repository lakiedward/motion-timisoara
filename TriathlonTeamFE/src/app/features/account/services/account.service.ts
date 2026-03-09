import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
  private readonly http = inject(HttpClient);

  getParentOverview(): Observable<ParentOverviewResponse> {
    return this.http.get<{ enrollments: any[]; payments: any[] }>('/api/parent/overview').pipe(
      map((payload) => ({
        enrollments: payload.enrollments.map((item) => this.mapEnrollment(item)),
        payments: payload.payments.map((item) => this.mapPayment(item))
      })),
      catchError(() => of(this.getMockOverview()))
    );
  }

  getParentEnrollments(): Observable<ParentEnrollment[]> {
    return this.http.get<any[]>('/api/parent/enrollments').pipe(
      map((items) => items.map((item) => this.mapEnrollment(item))),
      catchError(() => of(this.getMockOverview().enrollments))
    );
  }

  getRecentPayments(): Observable<RecentPayment[]> {
    return this.http.get<any[]>('/api/parent/payments').pipe(
      map((items) => items.map((item) => this.mapPayment(item))),
      catchError(() => of(this.getMockOverview().payments))
    );
  }

  getCalendarEvents(startDate: Date, endDate: Date): Observable<CalendarEvent[]> {
    const params = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
    return this.http.get<any[]>('/api/parent/calendar', { params }).pipe(
      map((items) => items.map((item) => this.mapCalendarEvent(item))),
      catchError(() => of(this.getMockCalendarEvents()))
    );
  }

  getUpcomingEvents(limit: number = 10): Observable<CalendarEvent[]> {
    return this.http.get<any[]>(`/api/parent/upcoming-events?limit=${limit}`).pipe(
      map((items) => items.map((item) => this.mapCalendarEvent(item))),
      catchError(() => of(this.getMockCalendarEvents().slice(0, limit)))
    );
  }

  private mapEnrollment(item: any): ParentEnrollment {
    const nextRaw =
      item.nextOccurrence ??
      item.nextSession ??
      item.startsAt ??
      item.nextDate ??
      item.nextCourseDate;
    const nextIso = typeof nextRaw === 'string' ? new Date(nextRaw).toISOString() : undefined;
    const kindValue = String(item.kind ?? item.type ?? 'course').toLowerCase();
    const normalizedKind: ParentEnrollment['kind'] = kindValue === 'camp' ? 'camp' : kindValue === 'activity' ? 'activity' : 'course';
    const paymentStatus = this.normalizePaymentStatus(item.paymentStatus ?? item.payment?.status ?? item.lastPayment?.status);
    const paymentMethod = this.normalizePaymentMethod(item.paymentMethod ?? item.payment?.method ?? item.lastPayment?.method);
    const purchasedSessions = this.toNumber(item.purchasedSessions ?? item.totalSessions ?? item.purchased);
    const remainingSessions = this.toNumber(item.remainingSessions ?? item.remaining ?? (purchasedSessions != null && item.sessionsUsed != null ? purchasedSessions - Number(item.sessionsUsed) : undefined));
    const sessionsUsed = this.toNumber(item.sessionsUsed ?? item.consumedSessions);

    return {
      id: String(item.id ?? this.generateId()),
      title: item.title ?? item.courseName ?? 'Curs',
      period: item.period ?? item.schedule ?? item.occursOn ?? 'Nespecificat',
      status: (item.status ?? 'active') as ParentEnrollment['status'],
      statusLabel: this.statusLabel(item.status ?? 'active'),
      childName: item.childName ?? item.child?.name ?? undefined,
      nextOccurrence: nextIso,
      kind: normalizedKind,
      location: item.location ?? item.locationName ?? item.venue ?? undefined,
      paymentStatus,
      paymentMethod,
      remainingSessions,
      purchasedSessions,
      sessionsUsed
    };
  }

  private mapPayment(item: any): RecentPayment {
    return {
      id: String(item.id ?? this.generateId()),
      description: item.description ?? 'Plata',
      amount: Number(item.amount ?? 0),
      currency: item.currency ?? 'RON',
      date: item.date ?? new Date().toISOString(),
      status: (item.status ?? 'completed') as RecentPayment['status'],
      statusLabel: this.paymentStatusLabel(item.status ?? 'completed')
    };
  }

  private mapCalendarEvent(item: any): CalendarEvent {
    const eventDate = item.date ? new Date(item.date) : new Date();
    const eventType = item.type?.toLowerCase();
    const normalizedType: CalendarEvent['type'] =
      eventType === 'camp' ? 'camp' : eventType === 'attendance' ? 'attendance' : 'course';

    return {
      id: String(item.id ?? this.generateId()),
      date: eventDate,
      type: normalizedType,
      title: item.title ?? item.name ?? 'Eveniment',
      location: item.location ?? item.locationName ?? undefined,
      time: item.time ?? item.timeSlot ?? undefined,
      childName: item.childName ?? item.child?.name ?? undefined
    };
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

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 10);
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

    // Add some mock course events
    for (let i = 1; i <= 30; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + i);

      // Course events on Mondays and Wednesdays
      if (eventDate.getDay() === 1 || eventDate.getDay() === 3) {
        events.push({
          id: `course-${i}`,
          date: eventDate,
          type: 'course',
          title: 'Curs Înot Avansați',
          location: 'Bazin Olimpic',
          time: '18:00',
          childName: 'Andrei Pop'
        });
      }

      // Course events on Tuesdays and Thursdays
      if (eventDate.getDay() === 2 || eventDate.getDay() === 4) {
        events.push({
          id: `course-cycling-${i}`,
          date: eventDate,
          type: 'course',
          title: 'Curs Ciclism',
          location: 'Baza Sportivă',
          time: '17:30',
          childName: 'Maria Pop'
        });
      }
    }

    // Add a camp event
    const campDate = new Date(today);
    campDate.setDate(today.getDate() + 10);
    events.push({
      id: 'camp-1',
      date: campDate,
      type: 'camp',
      title: 'Tabără Montană de Vară',
      location: 'Piatra Craiului',
      time: '09:00',
      childName: 'Maria Pop'
    });

    return events;
  }
}
