import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface AttendanceSession {
  id: string;
  date?: string;
  status: AttendanceStatus;
  statusLabel: string;
  note?: string;
}

export interface AttendanceCourse {
  id: string;
  name: string;
  sessions: AttendanceSession[];
}

export interface AttendanceResponse {
  courses: AttendanceCourse[];
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/parent/children';

  getChildAttendance(childId: string): Observable<AttendanceCourse[]> {
    return this.http
      .get<AttendanceResponse>(`${this.baseUrl}/${childId}/attendance`)
      .pipe(
        map((response) => this.mapResponse(response))
      );
  }

  private mapResponse(response: AttendanceResponse): AttendanceCourse[] {
    if (!response || !Array.isArray(response.courses)) {
      return [];
    }

    return response.courses.map((course) => ({
      id: String(course.id),
      name: course.name || 'Curs',
      sessions: (course.sessions || []).map((session) => ({
        id: String(session.id),
        date: session.date,
        status: this.normalizeStatus(session.status),
        statusLabel: session.statusLabel || 'Necunoscut',
        note: session.note
      }))
    }));
  }

  private normalizeStatus(status: string): AttendanceStatus {
    const normalized = String(status || 'present').toLowerCase();
    if (normalized === 'absent') return 'absent';
    if (normalized === 'excused' || normalized === 'motivated') return 'excused';
    return 'present';
  }
}
