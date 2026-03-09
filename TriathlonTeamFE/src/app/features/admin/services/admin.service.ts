import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_BASE_URL } from '../../../core/tokens/api-base-url.token';
import { AdminCoachListItem, InviteCoachPayload, UpdateCoachPayload } from './models/admin-coach.model';
import { AdminCamp, AdminCampPayload } from './models/admin-camp.model';
import { AdminClub, AdminClubDetail, UpdateClubPayload } from './models/admin-club.model';
import { AdminEnrollment } from './models/admin-enrollment.model';
import {
  AdminCourse,
  AdminCourseDetail,
  AdminCoursePayload,
  CoursePhotoItem
} from './models/admin-course.model';
import {
  AdminActivity,
  AdminActivityDetail,
  AdminActivityPayload
} from './models/admin-activity.model';
import { AdminSport } from './models/admin-sport.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = '/api/admin';

  private readonly childPhotoBust = new Map<string, number>();

  getAllCoaches(): Observable<AdminCoachListItem[]> {
    return this.http.get<AdminCoachListItem[]>(`${this.baseUrl}/coaches`);
  }

  getCoachById(coachId: string): Observable<AdminCoachListItem> {
    return this.http.get<AdminCoachListItem>(`${this.baseUrl}/coaches/${coachId}`);
  }

  inviteCoach(payload: InviteCoachPayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/coaches/invite`, payload);
  }

  updateCoach(coachId: string, payload: UpdateCoachPayload): Observable<AdminCoachListItem> {
    return this.http.put<AdminCoachListItem>(`${this.baseUrl}/coaches/${coachId}`, payload);
  }

  deleteCoach(coachId: string, force = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/coaches/${coachId}`, {
      params: { force: force.toString() }
    });
  }

  getCoachPhotoUrl(coachId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachId}/photo`;
  }

  getAllCamps(): Observable<AdminCamp[]> {
    return this.http.get<AdminCamp[]>(`${this.baseUrl}/camps`);
  }

  createCamp(payload: AdminCampPayload): Observable<AdminCamp> {
    return this.http.post<AdminCamp>(`${this.baseUrl}/camps`, payload);
  }

  updateCamp(campId: string, payload: AdminCampPayload): Observable<AdminCamp> {
    return this.http.put<AdminCamp>(`${this.baseUrl}/camps/${campId}`, payload);
  }

  getAllEnrollments(): Observable<AdminEnrollment[]> {
    return this.http.get<AdminEnrollment[]>(`${this.baseUrl}/enrollments`);
  }

  markCampPaid(enrollmentId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/enrollments/${enrollmentId}/mark-cash`, {});
  }

  getAllCourses(): Observable<AdminCourse[]> {
    return this.http.get<AdminCourse[]>(`${this.baseUrl}/courses`);
  }

  getCourseById(courseId: string): Observable<AdminCourseDetail> {
    return this.http.get<AdminCourseDetail>(`${this.baseUrl}/courses/${courseId}`);
  }

        createCourse(payload: AdminCoursePayload): Observable<AdminCourseDetail> {
    return this.http.post<AdminCourseDetail>(this.baseUrl + '/courses', payload);
  }
setCourseStatus(courseId: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/courses/${courseId}/status`, { active });
  }

  updateCourse(courseId: string, payload: AdminCoursePayload): Observable<AdminCourseDetail> {
    return this.http.put<AdminCourseDetail>(`${this.baseUrl}/courses/${courseId}`, payload);
  }

  deleteCourse(courseId: string, force = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/courses/${courseId}`, {
      params: { force: force.toString() }
    });
  }

  getCourseHeroPhotoUrl(courseId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}/api/admin/courses/${courseId}/hero-photo`;
  }

  uploadCourseHeroPhoto(courseId: string, photoBase64: string): Observable<AdminCourseDetail> {
    return this.http.post<AdminCourseDetail>(`${this.baseUrl}/courses/${courseId}/hero-photo`, { photo: photoBase64 });
  }

  deleteCourseHeroPhoto(courseId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/courses/${courseId}/hero-photo`);
  }

  uploadCoursePhoto(courseId: string, photo: string): Observable<CoursePhotoItem> {
    return this.http.post<CoursePhotoItem>(`${this.baseUrl}/courses/${courseId}/photos`, { photo });
  }

  getCoursePhotos(courseId: string): Observable<CoursePhotoItem[]> {
    return this.http.get<CoursePhotoItem[]>(`${this.baseUrl}/courses/${courseId}/photos`);
  }

  deleteCoursePhoto(courseId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/courses/${courseId}/photos/${photoId}`);
  }

  getCoursePhotoUrl(courseId: string, photoId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    // Use public endpoint for displaying images in <img> tags (no auth header)
    return `${base}/api/public/courses/${courseId}/photos/${photoId}`;
  }

  reorderCoursePhotos(courseId: string, photoIds: string[]): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/courses/${courseId}/photos/reorder`, { photoIds });
  }

  // ========== ACTIVITIES (Activități) ==========
  getAllActivities(): Observable<AdminActivity[]> {
    return this.http.get<AdminActivity[]>(`${this.baseUrl}/activities`);
  }

  getActivityById(activityId: string): Observable<AdminActivityDetail> {
    return this.http.get<AdminActivityDetail>(`${this.baseUrl}/activities/${activityId}`);
  }

  createActivity(payload: AdminActivityPayload): Observable<AdminActivityDetail> {
    return this.http.post<AdminActivityDetail>(`${this.baseUrl}/activities`, payload);
  }

  updateActivity(activityId: string, payload: AdminActivityPayload): Observable<AdminActivityDetail> {
    return this.http.put<AdminActivityDetail>(`${this.baseUrl}/activities/${activityId}`, payload);
  }

  setActivityStatus(activityId: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/activities/${activityId}/status`, { active });
  }

  deleteActivity(activityId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/activities/${activityId}`);
  }

  getActivityHeroPhoto(activityId: string): Observable<{ photo: string | null }> {
    return this.http.get<{ photo: string | null }>(`${this.baseUrl}/activities/${activityId}/hero-photo`);
  }

  uploadActivityHeroPhoto(activityId: string, photoBase64: string): Observable<AdminActivityDetail> {
    return this.http.post<AdminActivityDetail>(`${this.baseUrl}/activities/${activityId}/hero-photo`, { photo: photoBase64 });
  }

  deleteActivityHeroPhoto(activityId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/activities/${activityId}/hero-photo`);
  }

  // Invitation Codes
  getInvitationCodes(): Observable<InvitationCode[]> {
    return this.http.get<InvitationCode[]>(`${this.baseUrl}/invitation-codes`);
  }

  createInvitationCode(maxUses: number = 1, notes?: string): Observable<InvitationCode> {
    return this.http.post<InvitationCode>(`${this.baseUrl}/invitation-codes`, { maxUses, notes });
  }

  deleteInvitationCode(codeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/invitation-codes/${codeId}`);
  }

  revokeInvitationCode(codeId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/invitation-codes/${codeId}/revoke`, {});
  }

  // ========== CLUBS (Cluburi) ==========
  getAllClubs(): Observable<AdminClub[]> {
    return this.http.get<AdminClub[]>(`${this.baseUrl}/clubs`);
  }

  getClubById(clubId: string): Observable<AdminClubDetail> {
    return this.http.get<AdminClubDetail>(`${this.baseUrl}/clubs/${clubId}`);
  }

  updateClub(clubId: string, payload: UpdateClubPayload): Observable<AdminClubDetail> {
    return this.http.put<AdminClubDetail>(`${this.baseUrl}/clubs/${clubId}`, payload);
  }

  setClubStatus(clubId: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/clubs/${clubId}/status`, { active });
  }

  deleteClub(clubId: string, force: boolean = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clubs/${clubId}?force=${force}`);
  }

  getClubLogoUrl(clubId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    // Using admin endpoint for logo retrieval if authenticated as admin, or public if available.
    // The backend AdminClubController has getLogo at /api/admin/clubs/{id}/logo
    // But we might want to use a timestamp to bust cache
    const url = `${base}/api/admin/clubs/${clubId}/logo`;
    const bust = this.childPhotoBust.get(`club:${clubId}`);
    if (!bust) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${bust}`;
  }

  uploadClubLogo(clubId: string, base64: string): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/clubs/${clubId}/logo`, { logo: base64 })
      .pipe(
        tap(() => {
          this.childPhotoBust.set(`club:${clubId}`, Date.now());
        })
      );
  }

  updateClubSports(clubId: string, sportIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/clubs/${clubId}/sports`, sportIds);
  }

  // ========== SPORTS (Sporturi) ==========
  getAllSports(): Observable<AdminSport[]> {
    return this.http.get<AdminSport[]>(`${this.baseUrl}/sports`);
  }

  // ========== USERS (Utilizatori) ==========
  getAllUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/users`);
  }

  getUserById(userId: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.baseUrl}/users/${userId}`);
  }

  updateUser(userId: string, payload: UpdateUserPayload): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.baseUrl}/users/${userId}`, payload);
  }

  setUserStatus(userId: string, active: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${userId}/status`, null, {
      params: { active: active.toString() }
    });
  }

  setUserRole(userId: string, role: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${userId}/role`, null, {
      params: { role }
    });
  }

  deleteUser(userId: string, force = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${userId}`, {
      params: { force: force.toString() }
    });
  }

  // ========== USER CHILDREN (Admin manages parent's children) ==========
  getUserChildren(userId: string): Observable<AdminChild[]> {
    return this.http.get<AdminChild[]>(`${this.baseUrl}/users/${userId}/children`);
  }

  getUserChild(userId: string, childId: string): Observable<AdminChild> {
    return this.http.get<AdminChild>(`${this.baseUrl}/users/${userId}/children/${childId}`);
  }

  createUserChild(userId: string, payload: AdminChildPayload): Observable<AdminChild> {
    return this.http.post<AdminChild>(`${this.baseUrl}/users/${userId}/children`, payload);
  }

  updateUserChild(userId: string, childId: string, payload: AdminChildPayload): Observable<AdminChild> {
    return this.http.put<AdminChild>(`${this.baseUrl}/users/${userId}/children/${childId}`, payload);
  }

  deleteUserChild(userId: string, childId: string, force = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${userId}/children/${childId}`, {
      params: { force: force.toString() }
    });
  }

  getUserChildPhotoUrl(userId: string, childId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    const url = `${base}${this.baseUrl}/users/${userId}/children/${childId}/photo`;
    const bust = this.childPhotoBust.get(`${userId}:${childId}`);
    if (!bust) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${bust}`;
  }

  uploadUserChildPhoto(userId: string, childId: string, base64: string): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/users/${userId}/children/${childId}/photo`, { photo: base64 })
      .pipe(
        tap(() => {
          this.childPhotoBust.set(`${userId}:${childId}`, Date.now());
        })
      );
  }
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  enabled: boolean;
  createdAt: string;
  oauthProvider: string | null;
  avatarUrl: string | null;
  childrenCount: number;
  enrollmentsCount: number;
  clubId: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface InvitationCode {
  id: string;
  code: string;
  maxUses: number;
  currentUses: number;
  expiresAt: string;
  createdAt: string;
  notes: string | null;
  usedByEmail: string | null;
  createdByAdminEmail: string;
  valid: boolean;
  expired: boolean;
}

export interface AdminChild {
  id: string;
  name: string;
  birthDate: string;
  level: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyPhone: string | null;
  secondaryContactName: string | null;
  secondaryPhone: string | null;
  tshirtSize: string | null;
  hasPhoto: boolean;
  enrollmentsCount: number;
}

export interface AdminChildPayload {
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



