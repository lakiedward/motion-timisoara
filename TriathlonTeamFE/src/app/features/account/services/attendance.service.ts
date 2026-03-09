import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../core/services/supabase.service';

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
  private readonly supabase = inject(SupabaseService);

  getChildAttendance(childId: string): Observable<AttendanceCourse[]> {
    return from(this.fetchChildAttendance(childId)).pipe(
      map((courses) => courses)
    );
  }

  private async fetchChildAttendance(childId: string): Promise<AttendanceCourse[]> {
    // RLS ensures only parent's children are accessible
    const { data, error } = await this.supabase
      .from('attendance')
      .select(`
        id,
        status,
        created_at,
        course_occurrence:course_occurrences!course_occurrence_id (
          id,
          starts_at,
          course:courses!course_id (
            id,
            name
          )
        )
      `)
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return this.groupByCourse(data ?? []);
  }

  private groupByCourse(rows: any[]): AttendanceCourse[] {
    const courseMap = new Map<string, AttendanceCourse>();

    for (const row of rows) {
      const occurrence = row.course_occurrence;
      const course = occurrence?.course;
      if (!course) continue;

      const courseId = String(course.id);

      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          id: courseId,
          name: course.name || 'Curs',
          sessions: []
        });
      }

      const session: AttendanceSession = {
        id: String(row.id),
        date: occurrence.starts_at ?? undefined,
        status: this.normalizeStatus(row.status),
        statusLabel: this.statusLabel(this.normalizeStatus(row.status)),
        note: undefined
      };

      courseMap.get(courseId)!.sessions.push(session);
    }

    return Array.from(courseMap.values());
  }

  private normalizeStatus(status: string): AttendanceStatus {
    const normalized = String(status || 'PRESENT').toUpperCase();
    if (normalized === 'ABSENT') return 'absent';
    if (normalized === 'EXCUSED') return 'excused';
    return 'present';
  }

  private statusLabel(status: AttendanceStatus): string {
    switch (status) {
      case 'absent':
        return 'Absent';
      case 'excused':
        return 'Motivat';
      default:
        return 'Prezent';
    }
  }
}
