import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface AnnouncementAttachment {
  id: string;
  type: 'IMAGE' | 'VIDEO_LINK' | 'VIDEO_FILE';
  displayOrder: number;
  image: boolean;
  url?: string | null;
}

export interface AnnouncementDto {
  id: string;
  courseId?: string | null;
  courseName?: string | null;
  content: string;
  pinned: boolean;
  createdAt: string;
  authorName: string;
  authorRole: string;
  attachments: AnnouncementAttachment[];
}

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseService);

  private storageUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage(bucket).getPublicUrl(path);
    return data?.publicUrl ?? '';
  }

  // Coach/Admin endpoints
  listCoach(courseId: string): Observable<AnnouncementDto[]> {
    return this.http.get<AnnouncementDto[]>(`/api/coach/courses/${courseId}/announcements`);
  }

  createCoach(courseId: string, payload: { content: string; images?: string[]; videoUrls?: string[]; pinAfterPost?: boolean }): Observable<AnnouncementDto> {
    return this.http.post<AnnouncementDto>(`/api/coach/courses/${courseId}/announcements`, payload);
  }

  createCoachWithFiles(courseId: string, payload: { content: string; images?: string[]; videoUrls?: string[]; pinAfterPost?: boolean; videoFiles?: File[] }): Observable<AnnouncementDto> {
    const form = new FormData();
    form.append('content', payload.content ?? '');
    if (payload.images) {
      payload.images.forEach(i => form.append('images', i));
    }
    if (payload.videoUrls) {
      payload.videoUrls.forEach(v => form.append('videoUrls', v));
    }
    if (typeof payload.pinAfterPost === 'boolean') {
      form.append('pinAfterPost', String(payload.pinAfterPost));
    }
    if (payload.videoFiles) {
      payload.videoFiles.forEach(f => form.append('videoFiles', f));
    }
    return this.http.post<AnnouncementDto>(`/api/coach/courses/${courseId}/announcements/upload`, form);
  }

  setPinnedCoach(courseId: string, announcementId: string, pinned: boolean): Observable<void> {
    return this.http.patch<void>(`/api/coach/courses/${courseId}/announcements/${announcementId}/pin`, { pinned });
  }

  deleteCoach(courseId: string, announcementId: string): Observable<void> {
    return this.http.delete<void>(`/api/coach/courses/${courseId}/announcements/${announcementId}`);
  }

  // Parent endpoints
  listParentCourse(courseId: string): Observable<AnnouncementDto[]> {
    return this.http.get<AnnouncementDto[]>(`/api/parent/courses/${courseId}/announcements`);
  }

  listParentFeed(params: { courseId?: string | null; limit?: number } = {}): Observable<AnnouncementDto[]> {
    let httpParams = new HttpParams();
    if (params.courseId) httpParams = httpParams.set('courseId', params.courseId);
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<AnnouncementDto[]>(`/api/parent/announcements`, { params: httpParams });
  }

  // Image helpers
  getParentImageUrl(courseId: string, announcementId: string, imageId: string): string {
    return this.storageUrl('announcement-attachments', `${courseId}/${announcementId}/${imageId}`);
  }

  getCoachImageUrl(courseId: string, announcementId: string, imageId: string): string {
    return this.storageUrl('announcement-attachments', `${courseId}/${announcementId}/${imageId}`);
  }

  getParentVideoUrl(courseId: string, announcementId: string, videoId: string): string {
    return this.storageUrl('announcement-attachments', `${courseId}/${announcementId}/${videoId}`);
  }

  getCoachVideoUrl(courseId: string, announcementId: string, videoId: string): string {
    return this.storageUrl('announcement-attachments', `${courseId}/${announcementId}/${videoId}`);
  }

  // Utility: group by course from aggregated feed
  groupCoursesFromFeed(items: AnnouncementDto[]): { id: string; name: string }[] {
    const mapById = new Map<string, string>();
    items.forEach(a => {
      if (a.courseId && !mapById.has(a.courseId)) {
        mapById.set(a.courseId, a.courseName || 'Curs');
      }
    });
    return Array.from(mapById.entries()).map(([id, name]) => ({ id, name }));
  }
}
