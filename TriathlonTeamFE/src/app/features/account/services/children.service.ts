import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../../core/tokens/api-base-url.token';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export interface Child {
  id: string;
  name: string;
  birthDate: string;
  level?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyPhone: string;
  gdprConsentAt?: string;
  secondaryContactName?: string;
  secondaryPhone?: string;
  tshirtSize?: string;
  hasPhoto?: boolean;
}

export interface ChildPayload {
  name: string;
  birthDate: string;
  level?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyPhone: string;
  secondaryContactName?: string;
  secondaryPhone?: string;
  tshirtSize?: string;
}

export interface ScheduleConflict {
  conflictingCourseId: string;
  conflictingCourseName: string;
  dayOfWeek: string;
  timeRange: string;
}

export interface ChildValidationResult {
  childId: string;
  childName: string;
  isValid: boolean;
  ageValid: boolean;
  ageMessage: string | null;
  scheduleConflicts: ScheduleConflict[];
}

@Injectable({ providedIn: 'root' })
export class ChildrenService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/parent/children';
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly childPhotoBust = new Map<string, number>();

  private readonly childrenSubject = new BehaviorSubject<Child[]>([]);
  readonly children$ = this.childrenSubject.asObservable();

  loadChildren(): Observable<Child[]> {
    return this.http.get<any[]>(this.baseUrl).pipe(
      map((children) => (children ?? []).map((c) => this.mapChildResponse(c))),
      tap((children) => this.childrenSubject.next(children)),
      catchError((error) => {
        console.warn('Folosesc date mock pentru copii', error);
        const fallback = this.mockChildren();
        this.childrenSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  getChild(id: string): Observable<Child> {
    const cached = this.childrenSubject.value.find((child) => child.id === id);
    if (cached) {
      return of(cached);
    }
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(map((c) => this.mapChildResponse(c)));
  }

  getChildPhotoUrl(id: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    const url = `${base}${this.baseUrl}/${id}/photo`;
    const bust = this.childPhotoBust.get(id);
    if (!bust) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${bust}`;
  }

  uploadChildPhoto(id: string, base64: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/photo`, { photo: base64 }).pipe(
      tap(() => {
        this.childPhotoBust.set(id, Date.now());
        this.childrenSubject.next(
          this.childrenSubject.value.map((child) => (child.id === id ? { ...child, hasPhoto: true } : child))
        );
      })
    );
  }

  createChild(payload: ChildPayload): Observable<Child> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((c) => this.mapChildResponse(c)),
      tap((child) => this.childrenSubject.next([...this.childrenSubject.value, child]))
    );
  }

  updateChild(id: string, payload: ChildPayload): Observable<Child> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map((c) => this.mapChildResponse(c)),
      tap((child) => {
        this.childrenSubject.next(
          this.childrenSubject.value.map((existing) => (existing.id === id ? child : existing))
        );
      })
    );
  }

  deleteChild(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.childrenSubject.next(this.childrenSubject.value.filter((child) => child.id !== id)))
    );
  }

  saveChild(id: string | null, payload: ChildPayload): Observable<Child> {
    return id ? this.updateChild(id, payload) : this.createChild(payload);
  }

  validateChildren(courseId: string, childIds: string[]): Observable<ChildValidationResult[]> {
    return this.http.post<ChildValidationResult[]>('/api/enrollments/validate', {
      courseId,
      childIds
    });
  }

  private mockChildren(): Child[] {
    return [
      {
        id: 'child-1',
        name: 'Andrei Pop',
        birthDate: '2012-05-14',
        allergies: 'Alune',
        emergencyContactName: 'Mama - Irina',
        emergencyPhone: '+40733333111'
      },
      {
        id: 'child-2',
        name: 'Maria Pop',
        birthDate: '2015-09-02',
        allergies: '',
        emergencyContactName: 'Tata - Mihai',
        emergencyPhone: '+40733333222'
      }
    ];
  }

  private mapChildResponse(raw: any): Child {
    const rawId = raw.id ?? raw.childId ?? raw.child?.id;
    if (rawId == null) {
      console.warn('Child response missing id', raw);
      throw new Error('Child response missing id');
    }

    return {
      id: String(rawId),
      name: raw.name,
      birthDate: raw.birthDate ?? raw.birth_date,
      level: raw.level ?? undefined,
      allergies: raw.allergies ?? undefined,
      emergencyContactName: raw.emergencyContactName ?? raw.emergency_contact_name ?? undefined,
      emergencyPhone: raw.emergencyPhone ?? raw.emergency_phone,
      gdprConsentAt: raw.gdprConsentAt ?? raw.gdpr_consent_at ?? undefined,
      secondaryContactName: raw.secondaryContactName ?? raw.secondary_contact_name ?? undefined,
      secondaryPhone: raw.secondaryPhone ?? raw.secondary_phone ?? undefined,
      tshirtSize: raw.tshirtSize ?? raw.tshirt_size ?? undefined,
      hasPhoto: Boolean(raw.hasPhoto ?? raw.has_photo ?? false)
    };
  }
}
