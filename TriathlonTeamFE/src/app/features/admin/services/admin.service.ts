import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
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
  private readonly supabase = inject(SupabaseService);

  private readonly childPhotoBust = new Map<string, number>();

  // ========== COACHES ==========

  getAllCoaches(): Observable<AdminCoachListItem[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('coach_profiles')
          .select(`
            id, bio, photo_storage_path,
            user:profiles(id, name, email, phone, enabled),
            sports:coach_sports(sport:sports(id, name, code)),
            courses:courses(id)
          `);
        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.user?.name ?? '',
          email: row.user?.email ?? '',
          phone: row.user?.phone ?? undefined,
          bio: row.bio ?? undefined,
          sports: (row.sports ?? []).map((cs: any) => ({
            id: cs.sport?.id ?? '',
            name: cs.sport?.name ?? '',
            code: cs.sport?.code ?? '',
          })),
          cities: [],
          courseCount: (row.courses ?? []).length,
          enabled: Boolean(row.user?.enabled),
          hasPhoto: Boolean(row.photo_storage_path),
        })) as AdminCoachListItem[];
      })()
    );
  }

  getCoachById(coachId: string): Observable<AdminCoachListItem> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('coach_profiles')
          .select(`
            id, bio, photo_storage_path,
            user:profiles(id, name, email, phone, enabled),
            sports:coach_sports(sport:sports(id, name, code)),
            courses:courses(id)
          `)
          .eq('id', coachId)
          .single();
        if (error) throw error;

        const row: any = data;
        return {
          id: row.id,
          name: row.user?.name ?? '',
          email: row.user?.email ?? '',
          phone: row.user?.phone ?? undefined,
          bio: row.bio ?? undefined,
          sports: (row.sports ?? []).map((cs: any) => ({
            id: cs.sport?.id ?? '',
            name: cs.sport?.name ?? '',
            code: cs.sport?.code ?? '',
          })),
          cities: [],
          courseCount: (row.courses ?? []).length,
          enabled: Boolean(row.user?.enabled),
          hasPhoto: Boolean(row.photo_storage_path),
        } as AdminCoachListItem;
      })()
    );
  }

  inviteCoach(payload: InviteCoachPayload): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-invite-coach', payload)
    );
  }

  updateCoach(coachId: string, payload: UpdateCoachPayload): Observable<AdminCoachListItem> {
    return from(
      this.supabase.invokeFunction<AdminCoachListItem>('admin-update-coach', { coachId, ...payload })
    );
  }

  deleteCoach(coachId: string, force = false): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-coach', { coachId, force })
    );
  }

  getCoachPhotoUrl(coachId: string): string {
    // With Supabase, coach photos are stored in storage; build a storage URL
    // The photo_storage_path is stored in coach_profiles
    return `coach-photos/${coachId}`;
  }

  // ========== CAMPS ==========

  getAllCamps(): Observable<AdminCamp[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('camps')
          .select('*');
        if (error) throw error;

        // Get enrollment counts for each camp
        const campIds = (data ?? []).map((c: any) => c.id);
        let enrollmentCounts: Record<string, number> = {};
        if (campIds.length > 0) {
          const { data: enrollments } = await this.supabase
            .from('enrollments')
            .select('entity_id')
            .eq('entity_type', 'CAMP')
            .in('entity_id', campIds);
          (enrollments ?? []).forEach((e: any) => {
            enrollmentCounts[e.entity_id] = (enrollmentCounts[e.entity_id] ?? 0) + 1;
          });
        }

        return (data ?? []).map((camp: any) => ({
          id: camp.id,
          title: camp.title,
          slug: camp.slug,
          description: camp.description ?? null,
          periodStart: camp.period_start,
          periodEnd: camp.period_end,
          locationText: camp.location_text ?? null,
          capacity: camp.capacity ?? null,
          price: camp.price ?? 0,
          galleryJson: camp.gallery_json ?? null,
          allowCash: Boolean(camp.allow_cash),
          enrolledCount: enrollmentCounts[camp.id] ?? 0,
        })) as AdminCamp[];
      })()
    );
  }

  createCamp(payload: AdminCampPayload): Observable<AdminCamp> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('camps')
          .insert({
            title: payload.title,
            slug: payload.slug,
            description: payload.description,
            period_start: payload.periodStart,
            period_end: payload.periodEnd,
            location_text: payload.locationText,
            capacity: payload.capacity,
            price: payload.price,
            gallery_json: payload.galleryJson,
            allow_cash: payload.allowCash,
          })
          .select()
          .single();
        if (error) throw error;

        return {
          id: data.id,
          title: data.title,
          slug: data.slug,
          description: data.description ?? null,
          periodStart: data.period_start,
          periodEnd: data.period_end,
          locationText: data.location_text ?? null,
          capacity: data.capacity ?? null,
          price: data.price ?? 0,
          galleryJson: data.gallery_json ?? null,
          allowCash: Boolean(data.allow_cash),
          enrolledCount: 0,
        } as AdminCamp;
      })()
    );
  }

  updateCamp(campId: string, payload: AdminCampPayload): Observable<AdminCamp> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('camps')
          .update({
            title: payload.title,
            slug: payload.slug,
            description: payload.description,
            period_start: payload.periodStart,
            period_end: payload.periodEnd,
            location_text: payload.locationText,
            capacity: payload.capacity,
            price: payload.price,
            gallery_json: payload.galleryJson,
            allow_cash: payload.allowCash,
          })
          .eq('id', campId)
          .select()
          .single();
        if (error) throw error;

        return {
          id: data.id,
          title: data.title,
          slug: data.slug,
          description: data.description ?? null,
          periodStart: data.period_start,
          periodEnd: data.period_end,
          locationText: data.location_text ?? null,
          capacity: data.capacity ?? null,
          price: data.price ?? 0,
          galleryJson: data.gallery_json ?? null,
          allowCash: Boolean(data.allow_cash),
        } as AdminCamp;
      })()
    );
  }

  // ========== ENROLLMENTS ==========

  getAllEnrollments(): Observable<AdminEnrollment[]> {
    return from(
      this.supabase.invokeFunction<AdminEnrollment[]>('admin-get-enrollments', {})
    );
  }

  markCampPaid(enrollmentId: string): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-mark-camp-paid', { enrollmentId })
    );
  }

  // ========== COURSES ==========

  getAllCourses(): Observable<AdminCourse[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('courses')
          .select(`
            id, name, level, capacity, active, hero_photo_storage_path,
            sport:sports(name),
            coach:coach_profiles(user:profiles(name)),
            location:locations(name)
          `);
        if (error) throw error;

        // Get enrollment counts per course
        const courseIds = (data ?? []).map((c: any) => c.id);
        let enrollmentCounts: Record<string, { active: number; reserved: number; paid: number; unpaid: number }> = {};
        if (courseIds.length > 0) {
          const { data: enrollments } = await this.supabase
            .from('enrollments')
            .select('entity_id, status, payment_method')
            .eq('entity_type', 'COURSE')
            .in('entity_id', courseIds);
          (enrollments ?? []).forEach((e: any) => {
            if (!enrollmentCounts[e.entity_id]) {
              enrollmentCounts[e.entity_id] = { active: 0, reserved: 0, paid: 0, unpaid: 0 };
            }
            if (e.status === 'ACTIVE') enrollmentCounts[e.entity_id].active++;
            if (e.status === 'RESERVED') enrollmentCounts[e.entity_id].reserved++;
          });
        }

        return (data ?? []).map((row: any) => {
          const counts = enrollmentCounts[row.id] ?? { active: 0, reserved: 0, paid: 0, unpaid: 0 };
          return {
            id: row.id,
            name: row.name,
            coachName: row.coach?.user?.name ?? '',
            sport: row.sport?.name ?? '',
            level: row.level ?? null,
            location: row.location?.name ?? null,
            capacity: row.capacity ?? null,
            active: Boolean(row.active),
            enrolledCount: counts.active,
            reservedCount: counts.reserved,
            enrolledPaidCount: counts.paid,
            enrolledUnpaidCount: counts.unpaid,
            hasHeroPhoto: Boolean(row.hero_photo_storage_path),
          };
        }) as AdminCourse[];
      })()
    );
  }

  getCourseById(courseId: string): Observable<AdminCourseDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('courses')
          .select(`
            *,
            sport:sports(name),
            coach:coach_profiles(id, user:profiles(name)),
            location:locations(id, name),
            occurrences:course_occurrences(id, starts_at, ends_at)
          `)
          .eq('id', courseId)
          .single();
        if (error) throw error;

        const scheduleSlots = (data.occurrences ?? []).map((occ: any) => {
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
          coachId: data.coach?.id ?? data.coach_id,
          coachName: data.coach?.user?.name ?? '',
          sport: data.sport?.name ?? '',
          level: data.level ?? null,
          locationId: data.location?.id ?? data.location_id,
          location: data.location?.name ?? null,
          capacity: data.capacity ?? null,
          price: data.price ?? 0,
          pricePerSession: data.price_per_session ?? 0,
          packageOptions: data.package_options ?? null,
          active: Boolean(data.active),
          recurrenceRule: data.recurrence_rule ?? null,
          ageFrom: data.age_from ?? null,
          ageTo: data.age_to ?? null,
          scheduleSlots,
          hasHeroPhoto: Boolean(data.hero_photo_storage_path),
          description: data.description ?? null,
        } as AdminCourseDetail;
      })()
    );
  }

  createCourse(payload: AdminCoursePayload): Observable<AdminCourseDetail> {
    return from(
      this.supabase.invokeFunction<AdminCourseDetail>('admin-create-course', payload)
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

  updateCourse(courseId: string, payload: AdminCoursePayload): Observable<AdminCourseDetail> {
    return from(
      this.supabase.invokeFunction<AdminCourseDetail>('admin-update-course', { courseId, ...payload })
    );
  }

  deleteCourse(courseId: string, force = false): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-course', { courseId, force })
    );
  }

  getCourseHeroPhotoUrl(courseId: string): string {
    return `course-hero-photos/${courseId}`;
  }

  uploadCourseHeroPhoto(courseId: string, photoBase64: string): Observable<AdminCourseDetail> {
    return from(
      this.supabase.invokeFunction<AdminCourseDetail>('admin-upload-course-hero-photo', { courseId, photo: photoBase64 })
    );
  }

  deleteCourseHeroPhoto(courseId: string): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-course-hero-photo', { courseId })
    );
  }

  uploadCoursePhoto(courseId: string, photo: string): Observable<CoursePhotoItem> {
    return from(
      this.supabase.invokeFunction<CoursePhotoItem>('admin-upload-course-photo', { courseId, photo })
    );
  }

  getCoursePhotos(courseId: string): Observable<CoursePhotoItem[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('course_photos')
          .select('id, display_order, storage_path')
          .eq('course_id', courseId)
          .order('display_order');
        if (error) throw error;
        return (data ?? []).map((p: any) => ({
          id: p.id,
          displayOrder: p.display_order,
          url: p.storage_path ?? undefined,
        })) as CoursePhotoItem[];
      })()
    );
  }

  deleteCoursePhoto(courseId: string, photoId: string): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-course-photo', { courseId, photoId })
    );
  }

  getCoursePhotoUrl(courseId: string, photoId: string): string {
    return `course-photos/${courseId}/${photoId}`;
  }

  reorderCoursePhotos(courseId: string, photoIds: string[]): Observable<void> {
    return from(
      (async () => {
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

  // ========== ACTIVITIES (Activitati) ==========

  getAllActivities(): Observable<AdminActivity[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('activities')
          .select(`
            *,
            sport:sports(name, code),
            coach:coach_profiles(user:profiles(name)),
            location:locations(name)
          `);
        if (error) throw error;

        // Get enrollment counts
        const actIds = (data ?? []).map((a: any) => a.id);
        let enrollmentCounts: Record<string, { active: number; reserved: number }> = {};
        if (actIds.length > 0) {
          const { data: enrollments } = await this.supabase
            .from('enrollments')
            .select('entity_id, status')
            .eq('entity_type', 'ACTIVITY')
            .in('entity_id', actIds);
          (enrollments ?? []).forEach((e: any) => {
            if (!enrollmentCounts[e.entity_id]) {
              enrollmentCounts[e.entity_id] = { active: 0, reserved: 0 };
            }
            if (e.status === 'ACTIVE') enrollmentCounts[e.entity_id].active++;
            if (e.status === 'RESERVED') enrollmentCounts[e.entity_id].reserved++;
          });
        }

        return (data ?? []).map((row: any) => {
          const counts = enrollmentCounts[row.id] ?? { active: 0, reserved: 0 };
          return {
            id: row.id,
            name: row.name,
            coachName: row.coach?.user?.name ?? '',
            sport: row.sport?.code ?? '',
            sportName: row.sport?.name ?? '',
            location: row.location?.name ?? '',
            activityDate: row.activity_date,
            startTime: row.start_time,
            endTime: row.end_time,
            price: row.price ?? 0,
            currency: row.currency ?? 'RON',
            capacity: row.capacity ?? null,
            active: Boolean(row.active),
            enrolledCount: counts.active,
            reservedCount: counts.reserved,
            hasHeroPhoto: Boolean(row.hero_photo_storage_path),
          };
        }) as AdminActivity[];
      })()
    );
  }

  getActivityById(activityId: string): Observable<AdminActivityDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('activities')
          .select(`
            *,
            sport:sports(name, code),
            coach:coach_profiles(id, user:profiles(name)),
            location:locations(id, name)
          `)
          .eq('id', activityId)
          .single();
        if (error) throw error;

        return {
          id: data.id,
          name: data.name,
          description: data.description ?? null,
          coachId: data.coach?.id ?? data.coach_id,
          coachName: data.coach?.user?.name ?? '',
          sport: data.sport?.code ?? '',
          sportName: data.sport?.name ?? '',
          locationId: data.location?.id ?? data.location_id,
          locationName: data.location?.name ?? '',
          activityDate: data.activity_date,
          startTime: data.start_time,
          endTime: data.end_time,
          price: data.price ?? 0,
          currency: data.currency ?? 'RON',
          capacity: data.capacity ?? null,
          active: Boolean(data.active),
          hasHeroPhoto: Boolean(data.hero_photo_storage_path),
          createdAt: data.created_at,
        } as AdminActivityDetail;
      })()
    );
  }

  createActivity(payload: AdminActivityPayload): Observable<AdminActivityDetail> {
    return from(
      (async () => {
        // Look up sport_id from sport code
        const { data: sport } = await this.supabase
          .from('sports')
          .select('id')
          .eq('code', payload.sport)
          .single();

        const { data, error } = await this.supabase
          .from('activities')
          .insert({
            name: payload.name,
            description: payload.description,
            coach_id: payload.coachId,
            sport_id: sport?.id,
            location_id: payload.locationId,
            activity_date: payload.activityDate,
            start_time: payload.startTime,
            end_time: payload.endTime,
            price: payload.price,
            currency: payload.currency ?? 'RON',
            capacity: payload.capacity,
            active: payload.active ?? true,
          })
          .select(`
            *,
            sport:sports(name, code),
            coach:coach_profiles(id, user:profiles(name)),
            location:locations(id, name)
          `)
          .single();
        if (error) throw error;

        return {
          id: data.id,
          name: data.name,
          description: data.description ?? null,
          coachId: data.coach?.id ?? data.coach_id,
          coachName: data.coach?.user?.name ?? '',
          sport: data.sport?.code ?? '',
          sportName: data.sport?.name ?? '',
          locationId: data.location?.id ?? data.location_id,
          locationName: data.location?.name ?? '',
          activityDate: data.activity_date,
          startTime: data.start_time,
          endTime: data.end_time,
          price: data.price ?? 0,
          currency: data.currency ?? 'RON',
          capacity: data.capacity ?? null,
          active: Boolean(data.active),
          hasHeroPhoto: Boolean(data.hero_photo_storage_path),
          createdAt: data.created_at,
        } as AdminActivityDetail;
      })()
    );
  }

  updateActivity(activityId: string, payload: AdminActivityPayload): Observable<AdminActivityDetail> {
    return from(
      (async () => {
        // Look up sport_id from sport code
        const { data: sport } = await this.supabase
          .from('sports')
          .select('id')
          .eq('code', payload.sport)
          .single();

        const { data, error } = await this.supabase
          .from('activities')
          .update({
            name: payload.name,
            description: payload.description,
            coach_id: payload.coachId,
            sport_id: sport?.id,
            location_id: payload.locationId,
            activity_date: payload.activityDate,
            start_time: payload.startTime,
            end_time: payload.endTime,
            price: payload.price,
            currency: payload.currency ?? 'RON',
            capacity: payload.capacity,
            active: payload.active,
          })
          .eq('id', activityId)
          .select(`
            *,
            sport:sports(name, code),
            coach:coach_profiles(id, user:profiles(name)),
            location:locations(id, name)
          `)
          .single();
        if (error) throw error;

        return {
          id: data.id,
          name: data.name,
          description: data.description ?? null,
          coachId: data.coach?.id ?? data.coach_id,
          coachName: data.coach?.user?.name ?? '',
          sport: data.sport?.code ?? '',
          sportName: data.sport?.name ?? '',
          locationId: data.location?.id ?? data.location_id,
          locationName: data.location?.name ?? '',
          activityDate: data.activity_date,
          startTime: data.start_time,
          endTime: data.end_time,
          price: data.price ?? 0,
          currency: data.currency ?? 'RON',
          capacity: data.capacity ?? null,
          active: Boolean(data.active),
          hasHeroPhoto: Boolean(data.hero_photo_storage_path),
          createdAt: data.created_at,
        } as AdminActivityDetail;
      })()
    );
  }

  setActivityStatus(activityId: string, active: boolean): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('activities')
          .update({ active })
          .eq('id', activityId);
        if (error) throw error;
      })()
    );
  }

  deleteActivity(activityId: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('activities')
          .delete()
          .eq('id', activityId);
        if (error) throw error;
      })()
    );
  }

  getActivityHeroPhoto(activityId: string): Observable<{ photo: string | null }> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('activities')
          .select('hero_photo_storage_path')
          .eq('id', activityId)
          .single();
        if (error) throw error;
        return { photo: data.hero_photo_storage_path ?? null };
      })()
    );
  }

  uploadActivityHeroPhoto(activityId: string, photoBase64: string): Observable<AdminActivityDetail> {
    return from(
      this.supabase.invokeFunction<AdminActivityDetail>('admin-upload-activity-hero-photo', { activityId, photo: photoBase64 })
    );
  }

  deleteActivityHeroPhoto(activityId: string): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-activity-hero-photo', { activityId })
    );
  }

  // ========== INVITATION CODES ==========

  getInvitationCodes(): Observable<InvitationCode[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('coach_invitation_codes')
          .select(`
            *,
            creator:profiles!coach_invitation_codes_created_by_fkey(email)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;

        return (data ?? []).map((c: any) => ({
          id: c.id,
          code: c.code,
          maxUses: c.max_uses ?? 1,
          currentUses: c.current_uses ?? 0,
          expiresAt: c.expires_at ?? '',
          createdAt: c.created_at,
          notes: c.notes ?? null,
          usedByEmail: c.used_by_email ?? null,
          createdByAdminEmail: c.creator?.email ?? '',
          valid: Boolean(c.active),
          expired: c.expires_at ? new Date(c.expires_at) < new Date() : false,
        })) as InvitationCode[];
      })()
    );
  }

  createInvitationCode(maxUses: number = 1, notes?: string): Observable<InvitationCode> {
    return from(
      this.supabase.invokeFunction<InvitationCode>('admin-create-invitation-code', { maxUses, notes })
    );
  }

  deleteInvitationCode(codeId: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('coach_invitation_codes')
          .delete()
          .eq('id', codeId);
        if (error) throw error;
      })()
    );
  }

  revokeInvitationCode(codeId: string): Observable<{ message: string }> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('coach_invitation_codes')
          .update({ active: false })
          .eq('id', codeId);
        if (error) throw error;
        return { message: 'Invitation code revoked' };
      })()
    );
  }

  // ========== CLUBS (Cluburi) ==========

  getAllClubs(): Observable<AdminClub[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('clubs')
          .select(`
            *,
            coaches:club_coaches(coach_profile_id),
            courses:courses(id)
          `);
        if (error) throw error;

        return (data ?? []).map((club: any) => ({
          id: club.id,
          name: club.name,
          email: club.email ?? '',
          phone: club.phone ?? null,
          description: club.description ?? null,
          address: club.address ?? null,
          city: club.city ?? null,
          website: club.website ?? null,
          createdAt: club.created_at,
          active: Boolean(club.active),
          hasLogo: Boolean(club.logo_storage_path),
          coachCount: (club.coaches ?? []).length,
          courseCount: (club.courses ?? []).length,
          stripeConnected: Boolean(club.stripe_account_id),
        })) as AdminClub[];
      })()
    );
  }

  getClubById(clubId: string): Observable<AdminClubDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('clubs')
          .select(`
            *,
            sports:club_sports(sport:sports(id, name, code)),
            coaches:club_coaches(
              coach:coach_profiles(
                id,
                user:profiles(name, email)
              )
            ),
            courses:courses(id)
          `)
          .eq('id', clubId)
          .single();
        if (error) throw error;

        return {
          id: data.id,
          name: data.name,
          email: data.email ?? '',
          phone: data.phone ?? null,
          description: data.description ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          website: data.website ?? null,
          createdAt: data.created_at,
          active: Boolean(data.active),
          hasLogo: Boolean(data.logo_storage_path),
          coachCount: (data.coaches ?? []).length,
          courseCount: (data.courses ?? []).length,
          stripeConnected: Boolean(data.stripe_account_id),
          coaches: (data.coaches ?? []).map((cc: any) => ({
            id: cc.coach?.id ?? '',
            name: cc.coach?.user?.name ?? '',
            email: cc.coach?.user?.email ?? '',
          })),
          companyName: data.company_name ?? null,
          companyCui: data.company_cui ?? null,
          companyRegNumber: data.company_reg_number ?? null,
          companyAddress: data.company_address ?? null,
          bankAccount: data.bank_account ?? null,
          bankName: data.bank_name ?? null,
          sports: (data.sports ?? []).map((cs: any) => ({
            id: cs.sport?.id ?? '',
            name: cs.sport?.name ?? '',
            code: cs.sport?.code ?? '',
          })),
        } as AdminClubDetail;
      })()
    );
  }

  updateClub(clubId: string, payload: UpdateClubPayload): Observable<AdminClubDetail> {
    return from(
      (async () => {
        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.email !== undefined) updatePayload.email = payload.email;
        if (payload.description !== undefined) updatePayload.description = payload.description;
        if (payload.phone !== undefined) updatePayload.phone = payload.phone;
        if (payload.address !== undefined) updatePayload.address = payload.address;
        if (payload.city !== undefined) updatePayload.city = payload.city;
        if (payload.website !== undefined) updatePayload.website = payload.website;
        if (payload.companyName !== undefined) updatePayload.company_name = payload.companyName;
        if (payload.companyCui !== undefined) updatePayload.company_cui = payload.companyCui;
        if (payload.companyRegNumber !== undefined) updatePayload.company_reg_number = payload.companyRegNumber;
        if (payload.companyAddress !== undefined) updatePayload.company_address = payload.companyAddress;
        if (payload.bankAccount !== undefined) updatePayload.bank_account = payload.bankAccount;
        if (payload.bankName !== undefined) updatePayload.bank_name = payload.bankName;

        const { error } = await this.supabase
          .from('clubs')
          .update(updatePayload)
          .eq('id', clubId);
        if (error) throw error;

        // Return updated detail
        return await new Promise<AdminClubDetail>((resolve, reject) => {
          this.getClubById(clubId).subscribe({ next: resolve, error: reject });
        });
      })()
    );
  }

  setClubStatus(clubId: string, active: boolean): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('clubs')
          .update({ active })
          .eq('id', clubId);
        if (error) throw error;
      })()
    );
  }

  deleteClub(clubId: string, force: boolean = false): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-club', { clubId, force })
    );
  }

  getClubLogoUrl(clubId: string): string {
    const url = `club-logos/${clubId}`;
    const bust = this.childPhotoBust.get(`club:${clubId}`);
    if (!bust) return url;
    return `${url}?v=${bust}`;
  }

  uploadClubLogo(clubId: string, base64: string): Observable<void> {
    return from(
      (async () => {
        await this.supabase.invokeFunction<void>('admin-upload-club-logo', { clubId, logo: base64 });
        this.childPhotoBust.set(`club:${clubId}`, Date.now());
      })()
    );
  }

  updateClubSports(clubId: string, sportIds: string[]): Observable<void> {
    return from(
      (async () => {
        // Delete existing sport associations
        const { error: delError } = await this.supabase
          .from('club_sports')
          .delete()
          .eq('club_id', clubId);
        if (delError) throw delError;

        // Insert new sport associations
        if (sportIds.length > 0) {
          const rows = sportIds.map(sportId => ({ club_id: clubId, sport_id: sportId }));
          const { error: insError } = await this.supabase
            .from('club_sports')
            .insert(rows);
          if (insError) throw insError;
        }
      })()
    );
  }

  // ========== SPORTS (Sporturi) ==========

  getAllSports(): Observable<AdminSport[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('sports')
          .select('id, name, code');
        if (error) throw error;
        return (data ?? []) as AdminSport[];
      })()
    );
  }

  // ========== USERS (Utilizatori) ==========

  getAllUsers(): Observable<AdminUser[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('profiles')
          .select(`
            id, email, name, phone, role, enabled, created_at,
            oauth_provider, avatar_url
          `);
        if (error) throw error;

        // Get children counts and enrollment counts per user
        const userIds = (data ?? []).map((u: any) => u.id);
        let childrenCounts: Record<string, number> = {};
        let enrollmentCounts: Record<string, number> = {};
        let clubIds: Record<string, string | null> = {};

        if (userIds.length > 0) {
          const { data: children } = await this.supabase
            .from('children')
            .select('parent_id')
            .in('parent_id', userIds);
          (children ?? []).forEach((c: any) => {
            childrenCounts[c.parent_id] = (childrenCounts[c.parent_id] ?? 0) + 1;
          });

          const { data: clubs } = await this.supabase
            .from('clubs')
            .select('id, owner_user_id')
            .in('owner_user_id', userIds);
          (clubs ?? []).forEach((c: any) => {
            clubIds[c.owner_user_id] = c.id;
          });
        }

        return (data ?? []).map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone ?? null,
          role: u.role,
          enabled: Boolean(u.enabled),
          createdAt: u.created_at,
          oauthProvider: u.oauth_provider ?? null,
          avatarUrl: u.avatar_url ?? null,
          childrenCount: childrenCounts[u.id] ?? 0,
          enrollmentsCount: enrollmentCounts[u.id] ?? 0,
          clubId: clubIds[u.id] ?? null,
        })) as AdminUser[];
      })()
    );
  }

  getUserById(userId: string): Observable<AdminUser> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('profiles')
          .select('id, email, name, phone, role, enabled, created_at, oauth_provider, avatar_url')
          .eq('id', userId)
          .single();
        if (error) throw error;

        const { count: childrenCount } = await this.supabase
          .from('children')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', userId);

        const { data: club } = await this.supabase
          .from('clubs')
          .select('id')
          .eq('owner_user_id', userId)
          .maybeSingle();

        return {
          id: data.id,
          email: data.email,
          name: data.name,
          phone: data.phone ?? null,
          role: data.role,
          enabled: Boolean(data.enabled),
          createdAt: data.created_at,
          oauthProvider: data.oauth_provider ?? null,
          avatarUrl: data.avatar_url ?? null,
          childrenCount: childrenCount ?? 0,
          enrollmentsCount: 0,
          clubId: club?.id ?? null,
        } as AdminUser;
      })()
    );
  }

  updateUser(userId: string, payload: UpdateUserPayload): Observable<AdminUser> {
    return from(
      (async () => {
        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.email !== undefined) updatePayload.email = payload.email;
        if (payload.phone !== undefined) updatePayload.phone = payload.phone;
        if (payload.role !== undefined) updatePayload.role = payload.role;

        const { error } = await this.supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', userId);
        if (error) throw error;

        return await new Promise<AdminUser>((resolve, reject) => {
          this.getUserById(userId).subscribe({ next: resolve, error: reject });
        });
      })()
    );
  }

  setUserStatus(userId: string, active: boolean): Observable<AdminUser> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('profiles')
          .update({ enabled: active })
          .eq('id', userId);
        if (error) throw error;

        return await new Promise<AdminUser>((resolve, reject) => {
          this.getUserById(userId).subscribe({ next: resolve, error: reject });
        });
      })()
    );
  }

  setUserRole(userId: string, role: string): Observable<AdminUser> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('profiles')
          .update({ role })
          .eq('id', userId);
        if (error) throw error;

        return await new Promise<AdminUser>((resolve, reject) => {
          this.getUserById(userId).subscribe({ next: resolve, error: reject });
        });
      })()
    );
  }

  deleteUser(userId: string, force = false): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-user', { userId, force })
    );
  }

  // ========== USER CHILDREN (Admin manages parent's children) ==========

  getUserChildren(userId: string): Observable<AdminChild[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('children')
          .select('*')
          .eq('parent_id', userId);
        if (error) throw error;

        // Get enrollment counts per child
        const childIds = (data ?? []).map((c: any) => c.id);
        let enrollmentCounts: Record<string, number> = {};
        if (childIds.length > 0) {
          const { data: enrollments } = await this.supabase
            .from('enrollments')
            .select('child_id')
            .in('child_id', childIds);
          (enrollments ?? []).forEach((e: any) => {
            enrollmentCounts[e.child_id] = (enrollmentCounts[e.child_id] ?? 0) + 1;
          });
        }

        return (data ?? []).map((c: any) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          birthDate: c.birth_date,
          level: c.level ?? null,
          allergies: c.allergies ?? null,
          emergencyContactName: c.emergency_contact_name ?? null,
          emergencyPhone: c.emergency_phone ?? null,
          secondaryContactName: c.secondary_contact_name ?? null,
          secondaryPhone: c.secondary_phone ?? null,
          tshirtSize: c.tshirt_size ?? null,
          hasPhoto: Boolean(c.photo_storage_path),
          enrollmentsCount: enrollmentCounts[c.id] ?? 0,
        })) as AdminChild[];
      })()
    );
  }

  getUserChild(userId: string, childId: string): Observable<AdminChild> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('children')
          .select('*')
          .eq('id', childId)
          .eq('parent_id', userId)
          .single();
        if (error) throw error;

        const { count: enrollmentsCount } = await this.supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('child_id', childId);

        return {
          id: data.id,
          name: `${data.first_name} ${data.last_name}`,
          birthDate: data.birth_date,
          level: data.level ?? null,
          allergies: data.allergies ?? null,
          emergencyContactName: data.emergency_contact_name ?? null,
          emergencyPhone: data.emergency_phone ?? null,
          secondaryContactName: data.secondary_contact_name ?? null,
          secondaryPhone: data.secondary_phone ?? null,
          tshirtSize: data.tshirt_size ?? null,
          hasPhoto: Boolean(data.photo_storage_path),
          enrollmentsCount: enrollmentsCount ?? 0,
        } as AdminChild;
      })()
    );
  }

  createUserChild(userId: string, payload: AdminChildPayload): Observable<AdminChild> {
    return from(
      (async () => {
        const nameParts = payload.name.split(' ');
        const firstName = nameParts[0] ?? '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data, error } = await this.supabase
          .from('children')
          .insert({
            parent_id: userId,
            first_name: firstName,
            last_name: lastName,
            birth_date: payload.birthDate,
            level: payload.level,
            allergies: payload.allergies,
            emergency_contact_name: payload.emergencyContactName,
            emergency_phone: payload.emergencyPhone,
            secondary_contact_name: payload.secondaryContactName,
            secondary_phone: payload.secondaryPhone,
            tshirt_size: payload.tshirtSize,
          })
          .select()
          .single();
        if (error) throw error;

        return {
          id: data.id,
          name: `${data.first_name} ${data.last_name}`,
          birthDate: data.birth_date,
          level: data.level ?? null,
          allergies: data.allergies ?? null,
          emergencyContactName: data.emergency_contact_name ?? null,
          emergencyPhone: data.emergency_phone ?? null,
          secondaryContactName: data.secondary_contact_name ?? null,
          secondaryPhone: data.secondary_phone ?? null,
          tshirtSize: data.tshirt_size ?? null,
          hasPhoto: false,
          enrollmentsCount: 0,
        } as AdminChild;
      })()
    );
  }

  updateUserChild(userId: string, childId: string, payload: AdminChildPayload): Observable<AdminChild> {
    return from(
      (async () => {
        const nameParts = payload.name.split(' ');
        const firstName = nameParts[0] ?? '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data, error } = await this.supabase
          .from('children')
          .update({
            first_name: firstName,
            last_name: lastName,
            birth_date: payload.birthDate,
            level: payload.level,
            allergies: payload.allergies,
            emergency_contact_name: payload.emergencyContactName,
            emergency_phone: payload.emergencyPhone,
            secondary_contact_name: payload.secondaryContactName,
            secondary_phone: payload.secondaryPhone,
            tshirt_size: payload.tshirtSize,
          })
          .eq('id', childId)
          .eq('parent_id', userId)
          .select()
          .single();
        if (error) throw error;

        const { count: enrollmentsCount } = await this.supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('child_id', childId);

        return {
          id: data.id,
          name: `${data.first_name} ${data.last_name}`,
          birthDate: data.birth_date,
          level: data.level ?? null,
          allergies: data.allergies ?? null,
          emergencyContactName: data.emergency_contact_name ?? null,
          emergencyPhone: data.emergency_phone ?? null,
          secondaryContactName: data.secondary_contact_name ?? null,
          secondaryPhone: data.secondary_phone ?? null,
          tshirtSize: data.tshirt_size ?? null,
          hasPhoto: Boolean(data.photo_storage_path),
          enrollmentsCount: enrollmentsCount ?? 0,
        } as AdminChild;
      })()
    );
  }

  deleteUserChild(userId: string, childId: string, force = false): Observable<void> {
    return from(
      this.supabase.invokeFunction<void>('admin-delete-child', { userId, childId, force })
    );
  }

  getUserChildPhotoUrl(userId: string, childId: string): string {
    const url = `child-photos/${userId}/${childId}`;
    const bust = this.childPhotoBust.get(`${userId}:${childId}`);
    if (!bust) return url;
    return `${url}?v=${bust}`;
  }

  uploadUserChildPhoto(userId: string, childId: string, base64: string): Observable<void> {
    return from(
      (async () => {
        await this.supabase.invokeFunction<void>('admin-upload-child-photo', {
          userId, childId, photo: base64,
        });
        this.childPhotoBust.set(`${userId}:${childId}`, Date.now());
      })()
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
