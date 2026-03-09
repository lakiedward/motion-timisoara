import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ClubProfile {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  heroPhotoUrl?: string | null;
  website?: string;
  phone?: string;
  email?: string;
  publicEmailConsent?: boolean;
  address?: string;
  city?: string;
  stripeOnboardingComplete: boolean;
  canReceivePayments: boolean;
  companyName?: string;
  companyCui?: string;
  companyRegNumber?: string;
  companyAddress?: string;
  bankAccount?: string;
  bankName?: string;
  sports: string[];
  hasLogo: boolean;
  hasHeroPhoto: boolean;
}

export interface UpdateClubProfileRequest {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  publicEmailConsent?: boolean;
  address?: string;
  city?: string;
  website?: string;
  companyName?: string;
  companyCui?: string;
  companyRegNumber?: string;
  companyAddress?: string;
  bankAccount?: string;
  bankName?: string;
}

export interface ClubDashboardStats {
  coachCount: number;
  activeInvitationCodes: number;
  stripeOnboardingComplete: boolean;
  canReceivePayments: boolean;
}

export interface ClubCoach {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  sports: string[];
  stripeOnboardingComplete: boolean;
  canReceivePayments?: boolean;
  avatarUrl?: string;
  hasPhoto?: boolean;
}

export interface ClubCoachDetail {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  sportIds: string[];
  sports: string[];
  stripeOnboardingComplete: boolean;
  canReceivePayments?: boolean;
  avatarUrl?: string;
  hasPhoto: boolean;
}

export interface ClubInvitationCode {
  id: string;
  code: string;
  clubId: string;
  clubName: string;
  maxUses: number;
  currentUses: number;
  createdAt: string;
  expiresAt?: string;
  notes?: string;
  coachNameHint?: string;
  isValid: boolean;
  usedByCoachName?: string;
}

export interface CreateInvitationCodeRequest {
  maxUses?: number;
  expiresInDays?: number;
  notes?: string;
  coachNameHint?: string;
}

export interface CreateClubCoachRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  bio?: string;
  sportIds?: string[];
  photo?: string;
}

export interface UpdateClubCoachRequest {
  name: string;
  email: string;
  password?: string;
  phone?: string | null;
  bio?: string | null;
  sportIds?: string[];
  photo?: string;
}

export interface StripeStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresAction: boolean;
  canReceivePayments: boolean;
}

export interface ClubLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  description?: string;
  capacity?: number;
  isActive: boolean;
  lat?: number;
  lng?: number;
  type?: string;
}

export interface CreateClubLocationRequest {
  name: string;
  address?: string;
  city?: string;
  description?: string;
  capacity?: number;
  lat?: number;
  lng?: number;
  type?: string;
}

export interface UpdateClubLocationRequest {
  name?: string;
  address?: string;
  city?: string;
  description?: string;
  capacity?: number;
  isActive?: boolean;
  lat?: number;
  lng?: number;
  type?: string;
}

export interface ClubCourse {
  id: string;
  name: string;
  description?: string;
  sport: string;
  coachName: string;
  coachId: string;
  locationName: string;
  locationId: string;
  price: number;
  pricePerSession: number;
  currency: string;
  capacity?: number;
  level?: string;
  ageFrom?: number;
  ageTo?: number;
  isActive: boolean;
}

export interface ClubCourseScheduleSlot {
  day: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
}

export interface ClubCourseDetail {
  id: string;
  name: string;
  sport: string;
  level?: string | null;
  ageFrom?: number | null;
  ageTo?: number | null;
  coachId: string;
  locationId: string;
  capacity?: number | null;
  price: number;
  pricePerSession: number;
  packageOptions?: string | null;
  recurrenceRule?: string | null;
  active: boolean;
  description?: string | null;
  hasHeroPhoto?: boolean;
  scheduleSlots: ClubCourseScheduleSlot[];
  clubId?: string | null;
  clubName?: string | null;
  paymentRecipient?: 'COACH' | 'CLUB' | string;
}

export interface CoursePhotoItem {
  id: string;
  displayOrder: number;
}

export interface ClubCourseStats {
  totalCourses: number;
  activeCourses: number;
  totalCapacity: number;
}

export interface CreateClubCourseRequest {
  coachId: string;
  name: string;
  sport: string;
  level?: string | null;
  ageFrom?: number | null;
  ageTo?: number | null;
  locationId: string;
  capacity?: number | null;
  price: number;
  pricePerSession: number;
  packageOptions?: string | null;
  recurrenceRule: string;
  active?: boolean;
  description?: string | null;
  heroPhoto?: string | null;
  paymentRecipient?: 'COACH' | 'CLUB';
}

export interface UpdateClubCourseRequest {
  coachId: string;
  name: string;
  sport: string;
  level?: string | null;
  ageFrom?: number | null;
  ageTo?: number | null;
  locationId: string;
  capacity?: number | null;
  price: number;
  pricePerSession: number;
  packageOptions?: string | null;
  recurrenceRule: string;
  active: boolean;
  description?: string | null;
  heroPhoto?: string | null;
  paymentRecipient?: 'COACH' | 'CLUB';
}

export interface ClubAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isActive: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClubAnnouncementRequest {
  title: string;
  content: string;
  priority?: string;
}

export interface UpdateClubAnnouncementRequest {
  title?: string;
  content?: string;
  priority?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClubService {
  private readonly http = inject(HttpClient);

  // Profile
  getProfile(): Observable<ClubProfile> {
    return this.http.get<ClubProfile>('/api/club/profile', { withCredentials: true });
  }

  updateProfile(data: UpdateClubProfileRequest): Observable<ClubProfile> {
    return this.http.patch<ClubProfile>('/api/club/profile', data, { withCredentials: true });
  }

  withdrawEmailConsent(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/club/profile/consent/withdraw', {}, { withCredentials: true });
  }

  uploadProfileLogo(logo: string): Observable<ClubProfile> {
    return this.http.post<ClubProfile>('/api/club/profile/logo', { logo }, { withCredentials: true });
  }

  deleteProfileLogo(): Observable<ClubProfile> {
    return this.http.delete<ClubProfile>('/api/club/profile/logo', { withCredentials: true });
  }

  uploadProfileHeroPhoto(photo: string): Observable<ClubProfile> {
    return this.http.post<ClubProfile>('/api/club/profile/hero-photo', { photo }, { withCredentials: true });
  }

  deleteProfileHeroPhoto(): Observable<ClubProfile> {
    return this.http.delete<ClubProfile>('/api/club/profile/hero-photo', { withCredentials: true });
  }

  // Stats
  getStats(): Observable<ClubDashboardStats> {
    return this.http.get<ClubDashboardStats>('/api/club/stats', { withCredentials: true });
  }

  // Coaches
  getCoaches(): Observable<ClubCoach[]> {
    return this.http.get<ClubCoach[]>('/api/club/coaches', { withCredentials: true });
  }

  getCoachById(coachId: string): Observable<ClubCoachDetail> {
    return this.http.get<ClubCoachDetail>(`/api/club/coaches/${coachId}`, { withCredentials: true });
  }

  removeCoach(coachId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/club/coaches/${coachId}`, { withCredentials: true });
  }

  createCoach(request: CreateClubCoachRequest): Observable<ClubCoach> {
    return this.http.post<ClubCoach>('/api/club/coaches', request, { withCredentials: true });
  }

  updateCoach(coachId: string, request: UpdateClubCoachRequest): Observable<ClubCoachDetail> {
    return this.http.put<ClubCoachDetail>(`/api/club/coaches/${coachId}`, request, { withCredentials: true });
  }

  // Invitation Codes
  getInvitationCodes(): Observable<ClubInvitationCode[]> {
    return this.http.get<any[]>('/api/club/invitation-codes', { withCredentials: true }).pipe(
      map(codes => codes.map(c => this.normalizeInvitationCode(c)))
    );
  }

  createInvitationCode(request: CreateInvitationCodeRequest): Observable<ClubInvitationCode> {
    return this.http.post<any>('/api/club/invitation-codes', request, { withCredentials: true }).pipe(
      map(c => this.normalizeInvitationCode(c))
    );
  }

  // Normalize invitation code response (handle both 'valid' and 'isValid' from backend)
  private normalizeInvitationCode(code: any): ClubInvitationCode {
    return {
      ...code,
      isValid: code.isValid ?? code.valid ?? false
    };
  }

  deleteInvitationCode(codeId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/club/invitation-codes/${codeId}`, { withCredentials: true });
  }

  private normalizeClubLocation(location: any): ClubLocation {
    return {
      ...location,
      isActive: location.isActive ?? location.active ?? false
    };
  }

  // Stripe
  getStripeStatus(): Observable<StripeStatus> {
    return this.http.get<StripeStatus>('/api/club/stripe/status', { withCredentials: true });
  }

  refreshStripeStatus(): Observable<{ stripeOnboardingComplete: boolean; canReceivePayments: boolean }> {
    return this.http.get<StripeStatus>('/api/club/stripe/status', { withCredentials: true }).pipe(
      map(status => ({
        stripeOnboardingComplete: status.onboardingComplete,
        canReceivePayments: status.canReceivePayments
      }))
    );
  }

  getStripeOnboardingLink(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>('/api/club/stripe/onboarding-link', { withCredentials: true });
  }

  getStripeDashboardLink(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>('/api/club/stripe/dashboard-link', { withCredentials: true });
  }

  // Locations
  getLocations(): Observable<ClubLocation[]> {
    return this.http.get<any[]>('/api/club/locations', { withCredentials: true }).pipe(
      map(locations => locations.map(l => this.normalizeClubLocation(l)))
    );
  }

  createLocation(request: CreateClubLocationRequest): Observable<ClubLocation> {
    return this.http.post<any>('/api/club/locations', request, { withCredentials: true }).pipe(
      map(location => this.normalizeClubLocation(location))
    );
  }

  updateLocation(locationId: string, request: UpdateClubLocationRequest): Observable<ClubLocation> {
    const payload: any = { ...request };
    // Backward/forward compatible: some backends use `active`, others use `isActive`
    if (payload.isActive !== undefined && payload.active === undefined) {
      payload.active = payload.isActive;
    }
    if (payload.active !== undefined && payload.isActive === undefined) {
      payload.isActive = payload.active;
    }

    return this.http.put<any>(`/api/club/locations/${locationId}`, payload, { withCredentials: true }).pipe(
      map(location => this.normalizeClubLocation(location))
    );
  }

  deleteLocation(locationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/club/locations/${locationId}`, { withCredentials: true });
  }

  // Courses
  getCourses(): Observable<ClubCourse[]> {
    return this.http.get<ClubCourse[]>('/api/club/courses', { withCredentials: true });
  }

  getCourseById(courseId: string): Observable<ClubCourseDetail> {
    return this.http.get<ClubCourseDetail>(`/api/club/courses/${courseId}`, { withCredentials: true });
  }

  getCourseStats(): Observable<ClubCourseStats> {
    return this.http.get<ClubCourseStats>('/api/club/courses/stats', { withCredentials: true });
  }

  createCourse(request: CreateClubCourseRequest): Observable<any> {
    return this.http.post<any>('/api/club/courses', request, { withCredentials: true });
  }

  updateCourse(courseId: string, request: UpdateClubCourseRequest): Observable<any> {
    return this.http.put<any>(`/api/club/courses/${courseId}`, request, { withCredentials: true });
  }

  setCourseStatus(courseId: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`/api/club/courses/${courseId}/status`, { active }, { withCredentials: true });
  }

  deleteCourse(courseId: string, force = false): Observable<void> {
    const params = new HttpParams().set('force', force ? 'true' : 'false');
    return this.http.delete<void>(`/api/club/courses/${courseId}`, { withCredentials: true, params });
  }

  getCoursePhotos(courseId: string): Observable<CoursePhotoItem[]> {
    return this.http.get<CoursePhotoItem[]>(`/api/club/courses/${courseId}/photos`, { withCredentials: true });
  }

  uploadCoursePhoto(courseId: string, photo: string): Observable<CoursePhotoItem> {
    return this.http.post<CoursePhotoItem>(`/api/club/courses/${courseId}/photos`, { photo }, { withCredentials: true });
  }

  deleteCoursePhoto(courseId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(`/api/club/courses/${courseId}/photos/${photoId}`, { withCredentials: true });
  }

  reorderCoursePhotos(courseId: string, photoIds: string[]): Observable<void> {
    return this.http.patch<void>(`/api/club/courses/${courseId}/photos/reorder`, { photoIds }, { withCredentials: true });
  }

  // Announcements
  getAnnouncements(): Observable<ClubAnnouncement[]> {
    return this.http.get<ClubAnnouncement[]>('/api/club/announcements', { withCredentials: true });
  }

  createAnnouncement(request: CreateClubAnnouncementRequest): Observable<ClubAnnouncement> {
    return this.http.post<ClubAnnouncement>('/api/club/announcements', request, { withCredentials: true });
  }

  updateAnnouncement(id: string, request: UpdateClubAnnouncementRequest): Observable<ClubAnnouncement> {
    return this.http.put<ClubAnnouncement>(`/api/club/announcements/${id}`, request, { withCredentials: true });
  }

  deleteAnnouncement(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/club/announcements/${id}`, { withCredentials: true });
  }
}
