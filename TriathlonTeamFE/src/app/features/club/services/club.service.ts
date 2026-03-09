import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../core/services/supabase.service';

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
  private readonly supabase = inject(SupabaseService);

  // ─── Profile ────────────────────────────────────────────

  getProfile(): Observable<ClubProfile> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await this.supabase
          .from('clubs')
          .select(`
            *,
            sports:club_sports(sport:sports(name))
          `)
          .eq('owner_user_id', user.id)
          .single();
        if (error) throw error;

        return {
          id: data.id,
          name: data.name,
          description: data.description ?? undefined,
          logoUrl: data.logo_storage_path ?? undefined,
          heroPhotoUrl: data.hero_photo_storage_path ?? null,
          website: data.website ?? undefined,
          phone: data.phone ?? undefined,
          email: data.email ?? undefined,
          publicEmailConsent: data.public_email_consent ?? undefined,
          address: data.address ?? undefined,
          city: data.city ?? undefined,
          stripeOnboardingComplete: Boolean(data.stripe_onboarding_complete),
          canReceivePayments: Boolean(data.stripe_onboarding_complete && data.stripe_account_id),
          companyName: data.company_name ?? undefined,
          companyCui: data.company_cui ?? undefined,
          companyRegNumber: data.company_reg_number ?? undefined,
          companyAddress: data.company_address ?? undefined,
          bankAccount: data.bank_account ?? undefined,
          bankName: data.bank_name ?? undefined,
          sports: (data.sports ?? []).map((cs: any) => cs.sport?.name ?? ''),
          hasLogo: Boolean(data.logo_storage_path),
          hasHeroPhoto: Boolean(data.hero_photo_storage_path),
        } as ClubProfile;
      })()
    );
  }

  updateProfile(data: UpdateClubProfileRequest): Observable<ClubProfile> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await this.supabase
          .from('clubs')
          .update({
            name: data.name,
            description: data.description,
            phone: data.phone,
            email: data.email,
            public_email_consent: data.publicEmailConsent,
            address: data.address,
            city: data.city,
            website: data.website,
            company_name: data.companyName,
            company_cui: data.companyCui,
            company_reg_number: data.companyRegNumber,
            company_address: data.companyAddress,
            bank_account: data.bankAccount,
            bank_name: data.bankName,
          })
          .eq('owner_user_id', user.id);
        if (error) throw error;

        // Return the updated profile
        return await this.getProfile().toPromise();
      })()
    ) as Observable<ClubProfile>;
  }

  withdrawEmailConsent(): Observable<{ message: string }> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await this.supabase
          .from('clubs')
          .update({ public_email_consent: false })
          .eq('owner_user_id', user.id);
        if (error) throw error;

        return { message: 'Consent withdrawn' };
      })()
    );
  }

  uploadProfileLogo(logo: string): Observable<ClubProfile> {
    return from(
      this.supabase.invokeFunction<ClubProfile>('club-upload-logo', { logo })
    );
  }

  deleteProfileLogo(): Observable<ClubProfile> {
    return from(
      this.supabase.invokeFunction<ClubProfile>('club-delete-logo', {})
    );
  }

  uploadProfileHeroPhoto(photo: string): Observable<ClubProfile> {
    return from(
      this.supabase.invokeFunction<ClubProfile>('club-upload-hero-photo', { photo })
    );
  }

  deleteProfileHeroPhoto(): Observable<ClubProfile> {
    return from(
      this.supabase.invokeFunction<ClubProfile>('club-delete-hero-photo', {})
    );
  }

  // ─── Stats ──────────────────────────────────────────────

  getStats(): Observable<ClubDashboardStats> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get the club
        const { data: club } = await this.supabase
          .from('clubs')
          .select('id, stripe_onboarding_complete, stripe_account_id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        // Count coaches
        const { count: coachCount } = await this.supabase
          .from('club_coaches')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', club.id);

        // Count active invitation codes
        const { count: activeInvCodes } = await this.supabase
          .from('club_invitation_codes')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('active', true);

        return {
          coachCount: coachCount ?? 0,
          activeInvitationCodes: activeInvCodes ?? 0,
          stripeOnboardingComplete: Boolean(club.stripe_onboarding_complete),
          canReceivePayments: Boolean(club.stripe_onboarding_complete && club.stripe_account_id),
        };
      })()
    );
  }

  // ─── Coaches ────────────────────────────────────────────

  getCoaches(): Observable<ClubCoach[]> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        const { data, error } = await this.supabase
          .from('club_coaches')
          .select(`
            coach:coach_profiles(
              id, avatar_url, photo_storage_path,
              user:profiles(id, name, email, phone),
              sports:coach_sports(sport:sports(name))
            )
          `)
          .eq('club_id', club.id);
        if (error) throw error;

        return (data ?? []).map((row: any) => {
          const cp = row.coach;
          return {
            id: cp.id,
            userId: cp.user?.id ?? '',
            name: cp.user?.name ?? '',
            email: cp.user?.email ?? '',
            phone: cp.user?.phone ?? undefined,
            sports: (cp.sports ?? []).map((cs: any) => cs.sport?.name ?? ''),
            stripeOnboardingComplete: false,
            canReceivePayments: false,
            avatarUrl: cp.avatar_url ?? undefined,
            hasPhoto: Boolean(cp.photo_storage_path),
          } as ClubCoach;
        });
      })()
    );
  }

  getCoachById(coachId: string): Observable<ClubCoachDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('coach_profiles')
          .select(`
            id, bio, avatar_url, photo_storage_path,
            user:profiles(id, name, email, phone),
            sports:coach_sports(sport:sports(id, name))
          `)
          .eq('id', coachId)
          .single();
        if (error) throw error;

        const row: any = data;
        return {
          id: row.id,
          userId: row.user?.id ?? '',
          name: row.user?.name ?? '',
          email: row.user?.email ?? '',
          phone: row.user?.phone ?? undefined,
          bio: row.bio ?? undefined,
          sportIds: (row.sports ?? []).map((cs: any) => cs.sport?.id ?? ''),
          sports: (row.sports ?? []).map((cs: any) => cs.sport?.name ?? ''),
          stripeOnboardingComplete: false,
          canReceivePayments: false,
          avatarUrl: row.avatar_url ?? undefined,
          hasPhoto: Boolean(row.photo_storage_path),
        } as ClubCoachDetail;
      })()
    );
  }

  removeCoach(coachId: string): Observable<{ message: string }> {
    return from(
      this.supabase.invokeFunction<{ message: string }>('club-remove-coach', { coachId })
    );
  }

  createCoach(request: CreateClubCoachRequest): Observable<ClubCoach> {
    return from(
      this.supabase.invokeFunction<ClubCoach>('club-create-coach', request)
    );
  }

  updateCoach(coachId: string, request: UpdateClubCoachRequest): Observable<ClubCoachDetail> {
    return from(
      this.supabase.invokeFunction<ClubCoachDetail>('club-update-coach', { coachId, ...request })
    );
  }

  // ─── Invitation Codes ──────────────────────────────────

  getInvitationCodes(): Observable<ClubInvitationCode[]> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id, name')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        const { data, error } = await this.supabase
          .from('club_invitation_codes')
          .select('*')
          .eq('club_id', club.id)
          .order('created_at', { ascending: false });
        if (error) throw error;

        return (data ?? []).map((c: any) => ({
          id: c.id,
          code: c.code,
          clubId: c.club_id,
          clubName: club.name,
          maxUses: c.max_uses ?? 1,
          currentUses: c.current_uses ?? 0,
          createdAt: c.created_at,
          expiresAt: c.expires_at ?? undefined,
          notes: c.notes ?? undefined,
          coachNameHint: c.coach_name_hint ?? undefined,
          isValid: Boolean(c.active),
          usedByCoachName: c.used_by_coach_name ?? undefined,
        }));
      })()
    );
  }

  createInvitationCode(request: CreateInvitationCodeRequest): Observable<ClubInvitationCode> {
    return from(
      this.supabase.invokeFunction<ClubInvitationCode>('club-create-invitation-code', request)
    );
  }

  deleteInvitationCode(codeId: string): Observable<{ message: string }> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('club_invitation_codes')
          .delete()
          .eq('id', codeId);
        if (error) throw error;
        return { message: 'Invitation code deleted' };
      })()
    );
  }

  // ─── Stripe ─────────────────────────────────────────────

  getStripeStatus(): Observable<StripeStatus> {
    return from(
      this.supabase.invokeFunction<StripeStatus>('club-stripe-status', {})
    );
  }

  refreshStripeStatus(): Observable<{ stripeOnboardingComplete: boolean; canReceivePayments: boolean }> {
    return this.getStripeStatus().pipe(
      map(status => ({
        stripeOnboardingComplete: status.onboardingComplete,
        canReceivePayments: status.canReceivePayments,
      }))
    );
  }

  getStripeOnboardingLink(): Observable<{ url: string }> {
    return from(
      this.supabase.invokeFunction<{ url: string }>('club-stripe-onboarding-link', {})
    );
  }

  getStripeDashboardLink(): Observable<{ url: string }> {
    return from(
      this.supabase.invokeFunction<{ url: string }>('club-stripe-dashboard-link', {})
    );
  }

  // ─── Locations ──────────────────────────────────────────

  getLocations(): Observable<ClubLocation[]> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        // Get locations used by courses belonging to this club
        const { data: courses } = await this.supabase
          .from('courses')
          .select('location_id')
          .eq('club_id', club.id);
        const locationIds = [...new Set((courses ?? []).map((c: any) => c.location_id).filter(Boolean))];

        if (locationIds.length === 0) return [];

        const { data, error } = await this.supabase
          .from('locations')
          .select('*')
          .in('id', locationIds);
        if (error) throw error;

        return (data ?? []).map((l: any) => this.mapClubLocation(l));
      })()
    );
  }

  createLocation(request: CreateClubLocationRequest): Observable<ClubLocation> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('locations')
          .insert({
            name: request.name,
            address: request.address,
            city: request.city,
            type: request.type ?? 'OTHER',
            lat: request.lat,
            lng: request.lng,
            active: true,
          })
          .select()
          .single();
        if (error) throw error;
        return this.mapClubLocation(data);
      })()
    );
  }

  updateLocation(locationId: string, request: UpdateClubLocationRequest): Observable<ClubLocation> {
    return from(
      (async () => {
        const updatePayload: any = {};
        if (request.name !== undefined) updatePayload.name = request.name;
        if (request.address !== undefined) updatePayload.address = request.address;
        if (request.city !== undefined) updatePayload.city = request.city;
        if (request.type !== undefined) updatePayload.type = request.type;
        if (request.lat !== undefined) updatePayload.lat = request.lat;
        if (request.lng !== undefined) updatePayload.lng = request.lng;
        if (request.isActive !== undefined) updatePayload.active = request.isActive;

        const { data, error } = await this.supabase
          .from('locations')
          .update(updatePayload)
          .eq('id', locationId)
          .select()
          .single();
        if (error) throw error;
        return this.mapClubLocation(data);
      })()
    );
  }

  deleteLocation(locationId: string): Observable<{ message: string }> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('locations')
          .delete()
          .eq('id', locationId);
        if (error) throw error;
        return { message: 'Location deleted' };
      })()
    );
  }

  // ─── Courses ────────────────────────────────────────────

  getCourses(): Observable<ClubCourse[]> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        const { data, error } = await this.supabase
          .from('courses')
          .select(`
            *,
            sport:sports(name),
            coach:coach_profiles(id, user:profiles(name)),
            location:locations(id, name)
          `)
          .eq('club_id', club.id);
        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          sport: row.sport?.name ?? '',
          coachName: row.coach?.user?.name ?? '',
          coachId: row.coach?.id ?? '',
          locationName: row.location?.name ?? '',
          locationId: row.location?.id ?? '',
          price: row.price ?? 0,
          pricePerSession: row.price_per_session ?? 0,
          currency: row.currency ?? 'RON',
          capacity: row.capacity ?? undefined,
          level: row.level ?? undefined,
          ageFrom: row.age_from ?? undefined,
          ageTo: row.age_to ?? undefined,
          isActive: Boolean(row.active),
        }));
      })()
    );
  }

  getCourseById(courseId: string): Observable<ClubCourseDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('courses')
          .select(`
            *,
            sport:sports(name),
            club:clubs(id, name),
            occurrences:course_occurrences(id, starts_at, ends_at)
          `)
          .eq('id', courseId)
          .single();
        if (error) throw error;

        const scheduleSlots: ClubCourseScheduleSlot[] = (data.occurrences ?? []).map((occ: any) => {
          const dt = new Date(occ.starts_at);
          const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const dayLabels = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
          const dayIdx = dt.getDay();
          return {
            day: days[dayIdx],
            dayLabel: dayLabels[dayIdx],
            startTime: occ.starts_at?.substring(11, 16) ?? '',
            endTime: occ.ends_at?.substring(11, 16) ?? '',
          };
        });

        return {
          id: data.id,
          name: data.name,
          sport: data.sport?.name ?? '',
          level: data.level ?? null,
          ageFrom: data.age_from ?? null,
          ageTo: data.age_to ?? null,
          coachId: data.coach_id,
          locationId: data.location_id,
          capacity: data.capacity ?? null,
          price: data.price ?? 0,
          pricePerSession: data.price_per_session ?? 0,
          packageOptions: data.package_options ?? null,
          recurrenceRule: data.recurrence_rule ?? null,
          active: Boolean(data.active),
          description: data.description ?? null,
          hasHeroPhoto: Boolean(data.hero_photo_storage_path),
          scheduleSlots,
          clubId: data.club?.id ?? null,
          clubName: data.club?.name ?? null,
          paymentRecipient: data.payment_recipient ?? undefined,
        } as ClubCourseDetail;
      })()
    );
  }

  getCourseStats(): Observable<ClubCourseStats> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        const { data, error } = await this.supabase
          .from('courses')
          .select('id, active, capacity')
          .eq('club_id', club.id);
        if (error) throw error;

        const courses = data ?? [];
        return {
          totalCourses: courses.length,
          activeCourses: courses.filter((c: any) => c.active).length,
          totalCapacity: courses.reduce((sum: number, c: any) => sum + (c.capacity ?? 0), 0),
        };
      })()
    );
  }

  createCourse(request: CreateClubCourseRequest): Observable<any> {
    return from(
      this.supabase.invokeFunction('club-create-course', request)
    );
  }

  updateCourse(courseId: string, request: UpdateClubCourseRequest): Observable<any> {
    return from(
      this.supabase.invokeFunction('club-update-course', { courseId, ...request })
    );
  }

  setCourseStatus(courseId: string, active: boolean): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('courses')
          .update({ active })
          .eq('id', courseId);
        if (error) throw error;
      })()
    );
  }

  deleteCourse(courseId: string, force = false): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('club-delete-course', { courseId, force })
    );
  }

  getCoursePhotos(courseId: string): Observable<CoursePhotoItem[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('course_photos')
          .select('id, display_order')
          .eq('course_id', courseId)
          .order('display_order');
        if (error) throw error;
        return (data ?? []).map((p: any) => ({
          id: p.id,
          displayOrder: p.display_order,
        }));
      })()
    );
  }

  uploadCoursePhoto(courseId: string, photo: string): Observable<CoursePhotoItem> {
    return from(
      this.supabase.invokeFunction<CoursePhotoItem>('club-upload-course-photo', { courseId, photo })
    );
  }

  deleteCoursePhoto(courseId: string, photoId: string): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('club-delete-course-photo', { courseId, photoId })
    );
  }

  reorderCoursePhotos(courseId: string, photoIds: string[]): Observable<void> {
    return from(
      (async () => {
        // Update display_order for each photo
        for (let i = 0; i < photoIds.length; i++) {
          const { error } = await this.supabase
            .from('course_photos')
            .update({ display_order: i })
            .eq('id', photoIds[i])
            .eq('course_id', courseId);
          if (error) throw error;
        }
      })()
    );
  }

  // ─── Announcements ─────────────────────────────────────

  getAnnouncements(): Observable<ClubAnnouncement[]> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        const { data, error } = await this.supabase
          .from('club_announcements')
          .select('*, author:profiles(name)')
          .eq('club_id', club.id)
          .order('created_at', { ascending: false });
        if (error) throw error;

        return (data ?? []).map((a: any) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          priority: a.priority ?? 'NORMAL',
          isActive: Boolean(a.is_active ?? a.active ?? true),
          authorName: a.author?.name ?? '',
          createdAt: a.created_at,
          updatedAt: a.updated_at ?? a.created_at,
        }));
      })()
    );
  }

  createAnnouncement(request: CreateClubAnnouncementRequest): Observable<ClubAnnouncement> {
    return from(
      (async () => {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', user.id)
          .single();
        if (!club) throw new Error('Club not found');

        const { data, error } = await this.supabase
          .from('club_announcements')
          .insert({
            club_id: club.id,
            author_id: user.id,
            title: request.title,
            content: request.content,
            priority: request.priority ?? 'NORMAL',
            is_active: true,
          })
          .select('*, author:profiles(name)')
          .single();
        if (error) throw error;

        return {
          id: data.id,
          title: data.title,
          content: data.content,
          priority: data.priority ?? 'NORMAL',
          isActive: Boolean(data.is_active ?? true),
          authorName: data.author?.name ?? '',
          createdAt: data.created_at,
          updatedAt: data.updated_at ?? data.created_at,
        } as ClubAnnouncement;
      })()
    );
  }

  updateAnnouncement(id: string, request: UpdateClubAnnouncementRequest): Observable<ClubAnnouncement> {
    return from(
      (async () => {
        const updatePayload: any = {};
        if (request.title !== undefined) updatePayload.title = request.title;
        if (request.content !== undefined) updatePayload.content = request.content;
        if (request.priority !== undefined) updatePayload.priority = request.priority;
        if (request.isActive !== undefined) updatePayload.is_active = request.isActive;

        const { data, error } = await this.supabase
          .from('club_announcements')
          .update(updatePayload)
          .eq('id', id)
          .select('*, author:profiles(name)')
          .single();
        if (error) throw error;

        return {
          id: data.id,
          title: data.title,
          content: data.content,
          priority: data.priority ?? 'NORMAL',
          isActive: Boolean(data.is_active ?? true),
          authorName: data.author?.name ?? '',
          createdAt: data.created_at,
          updatedAt: data.updated_at ?? data.created_at,
        } as ClubAnnouncement;
      })()
    );
  }

  deleteAnnouncement(id: string): Observable<{ message: string }> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('club_announcements')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return { message: 'Announcement deleted' };
      })()
    );
  }

  // ─── Private helpers ───────────────────────────────────

  private mapClubLocation(l: any): ClubLocation {
    return {
      id: l.id,
      name: l.name,
      address: l.address ?? undefined,
      city: l.city ?? undefined,
      description: l.description ?? undefined,
      capacity: l.capacity ?? undefined,
      isActive: Boolean(l.active),
      lat: l.lat ?? undefined,
      lng: l.lng ?? undefined,
      type: l.type ?? undefined,
    };
  }
}
