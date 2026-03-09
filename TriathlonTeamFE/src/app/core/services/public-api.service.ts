import { inject, Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

export type SportType = 'inot' | 'ciclism' | 'alergare' | 'triatlon' | 'fitness';
export type CourseLevel = 'incepator' | 'intermediar' | 'avansat' | string;

export interface ScheduleFilters {
  sport?: SportType;
  dayOfWeek?: number;
  level?: CourseLevel;
  ageFrom?: number;
  ageTo?: number;
  locationId?: string;
  coachId?: string;
  clubId?: string;
  page?: number;
  size?: number;
}

export interface CoachFilters {
  sportId?: string;
  locationId?: string;
  clubId?: string;
}

export interface CoachLocationSummary {
  id: string;
  name: string;
  sports: PublicSport[];
}

export interface CoachDisciplineSummary {
  sport: PublicSport;
  levels: string[];
}

export interface CoachSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  summary?: string;
  disciplines: CoachDisciplineSummary[];
  locations: CoachLocationSummary[];
  activeCourseCount?: number;
  averageRating?: number;
  totalRatings?: number;
}

export interface CoachCourseSummary {
  id: string;
  name: string;
  sport?: PublicSport;
  level?: CourseLevel;
}

export interface CoachDetail extends CoachSummary {
  headline?: string;
  biography?: string;
  focusAreas?: string[];
  courses?: CoachCourseSummary[];
}

export interface LocationSummary {
  id: string;
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  type?: string;
}

export interface PublicClubSport {
  id: string;
  code: string;
  name: string;
}

export interface PublicClubSummary {
  id: string;
  name: string;
  description?: string;
  city?: string;
  website?: string;
  phone?: string;
  logoUrl?: string;
  heroPhotoUrl?: string | null;
  coachCount: number;
  sports: PublicClubSport[];
  email?: string;
}

export type PublicClubDetail = PublicClubSummary;

export interface CourseOccurrence {
  id: string;
  startTime: string;
  endTime: string;
}

export interface ProgramCourse {
  id: string;
  name: string;
  sport: PublicSport;
  price: number;
  pricePerSession: number;
  packageOptions?: string;
  currency: string;
  coach: CoachSummary;
  location: LocationSummary;
  occurrences: CourseOccurrence[];
  level?: CourseLevel;
  ageMin?: number;
  ageMax?: number;
  durationMinutes?: number;
  description?: string;
  heroPhotoUrl?: string;
  capacity?: number;
  spotsLeft?: number;
  averageRating?: number;
  totalRatings?: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PublicSport {
  id: string;
  code: string;
  name: string;
}

export interface CourseDetail extends ProgramCourse {
  whatWeLearn?: string[];
  coachBio?: string;
  faqs?: FaqItem[];
  gallery?: string[];
}

export interface CampSummary {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string;
  price: number;
  currency: string;
  allowCash: boolean;
  heroImageUrl?: string;
  summary?: string;
  description?: string;
  soldOut: boolean;
  capacity?: number;
}

export interface CampDetail extends CampSummary {
  gallery: string[];
}

// Activity interfaces
export interface PublicActivitySummary {
  id: string;
  name: string;
  sport: PublicSport;
  activityDate: string;
  startTime: string;
  endTime: string;
  locationId?: string;
  location: string;
  price: number;
  currency: string;
  capacity: number | null;
  spotsLeft: number | null;
  hasHeroPhoto: boolean;
  heroPhotoUrl: string | null;
}

export interface PublicActivityDetail {
  id: string;
  name: string;
  description: string | null;
  sport: PublicSport;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  capacity: number | null;
  spotsLeft: number | null;
  enrolledCount: number;
  heroPhotoUrl: string | null;
  coach: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  location: LocationSummary;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ContactMessageRequest {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
}

const DEFAULT_CURRENCY = 'RON';
const FALLBACK_LOCATION = 'Locatie in curs de confirmare';

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly supabase = inject(SupabaseService);

  // Cache for locations to prevent multiple requests
  private locationsCache$?: Observable<LocationSummary[]>;
  private sportsCache$?: Observable<PublicSport[]>;

  getSchedule(filters: ScheduleFilters = {}): Observable<PagedResponse<ProgramCourse>> {
    const page = filters.page ?? 0;
    const size = filters.size ?? 20;
    const rangeFrom = page * size;
    const rangeTo = rangeFrom + size - 1;

    return from(
      (async () => {
        let query = this.supabase
          .from('courses')
          .select(
            `
            *,
            sport:sports(*),
            coach:coach_profiles(
              id, bio, avatar_url,
              user:profiles(id, name)
            ),
            location:locations(id, name, address, city, lat, lng, type),
            occurrences:course_occurrences(id, starts_at, ends_at)
          `,
            { count: 'exact' }
          )
          .eq('active', true)
          .range(rangeFrom, rangeTo);

        if (filters.sport) {
          // Filter by sport code via a subquery
          const { data: sportRows } = await this.supabase
            .from('sports')
            .select('id')
            .eq('code', filters.sport);
          if (sportRows && sportRows.length > 0) {
            query = query.eq('sport_id', sportRows[0].id);
          }
        }
        if (filters.level) {
          query = query.eq('level', filters.level);
        }
        if (filters.ageFrom != null) {
          query = query.gte('age_to', filters.ageFrom);
        }
        if (filters.ageTo != null) {
          query = query.lte('age_from', filters.ageTo);
        }
        if (filters.locationId) {
          query = query.eq('location_id', filters.locationId);
        }
        if (filters.coachId) {
          query = query.eq('coach_id', filters.coachId);
        }
        if (filters.clubId) {
          query = query.eq('club_id', filters.clubId);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        const totalElements = count ?? 0;
        const totalPages = Math.ceil(totalElements / size);

        const content: ProgramCourse[] = (data ?? []).map((row: any) =>
          this.mapCourseToProgramCourse(row)
        );

        return { content, totalElements, totalPages, page, size };
      })()
    );
  }

  getPublicSports(): Observable<PublicSport[]> {
    if (!this.sportsCache$) {
      this.sportsCache$ = from(
        this.supabase.from('sports').select('*').then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((s: any) => ({ id: s.id, code: s.code, name: s.name }));
        })
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.sportsCache$;
  }

  getPublicLocations(): Observable<LocationSummary[]> {
    if (!this.locationsCache$) {
      this.locationsCache$ = from(
        this.supabase
          .from('locations')
          .select('*')
          .eq('active', true)
          .then(({ data, error }) => {
            if (error) throw error;
            return (data ?? []).map((l: any) => ({
              id: l.id,
              name: l.name,
              address: l.address ?? undefined,
              city: l.city ?? undefined,
              lat: l.lat ?? undefined,
              lng: l.lng ?? undefined,
              type: l.type ?? undefined,
            }));
          })
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.locationsCache$;
  }

  getCoaches(filters: CoachFilters = {}): Observable<CoachSummary[]> {
    return from(
      (async () => {
        let query = this.supabase.from('coach_profiles').select(`
          id, bio, avatar_url,
          user:profiles!coach_profiles_user_id_fkey(id, name),
          sports:coach_sports(sport:sports(*))
        `);

        if (filters.clubId) {
          const { data: clubCoachRows } = await this.supabase
            .from('club_coaches')
            .select('coach_profile_id')
            .eq('club_id', filters.clubId);
          const ids = (clubCoachRows ?? []).map((r: any) => r.coach_profile_id);
          if (ids.length > 0) {
            query = query.in('id', ids);
          } else {
            return [];
          }
        }

        if (filters.sportId) {
          const { data: coachSportRows } = await this.supabase
            .from('coach_sports')
            .select('coach_profile_id')
            .eq('sport_id', filters.sportId);
          const ids = (coachSportRows ?? []).map((r: any) => r.coach_profile_id);
          if (ids.length > 0) {
            query = query.in('id', ids);
          } else {
            return [];
          }
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data ?? []).map((row: any) => this.mapCoachSummary(row));
      })()
    );
  }

  getPublicClubs(): Observable<PublicClubSummary[]> {
    return from(
      this.supabase
        .from('clubs')
        .select(
          `
          *,
          sports:club_sports(sport:sports(*)),
          coaches:club_coaches(coach_profile_id)
        `
        )
        .eq('active', true)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((club: any) => this.mapClubSummary(club));
        })
    );
  }

  getPublicClub(id: string): Observable<PublicClubDetail> {
    return from(
      this.supabase
        .from('clubs')
        .select(
          `
          *,
          sports:club_sports(sport:sports(*)),
          coaches:club_coaches(coach_profile_id)
        `
        )
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return this.mapClubSummary(data);
        })
    );
  }

  getCoach(id: string): Observable<CoachDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('coach_profiles')
          .select(
            `
            id, bio, avatar_url,
            user:profiles!coach_profiles_user_id_fkey(id, name),
            sports:coach_sports(sport:sports(*))
          `
          )
          .eq('id', id)
          .single();
        if (error) throw error;

        // Get courses for this coach
        const { data: courses } = await this.supabase
          .from('courses')
          .select('id, name, sport:sports(*), level')
          .eq('coach_id', id)
          .eq('active', true);

        const summary = this.mapCoachSummary(data);
        return {
          ...summary,
          biography: data.bio ?? undefined,
          courses: (courses ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            sport: c.sport ? { id: c.sport.id, code: c.sport.code, name: c.sport.name } : undefined,
            level: c.level ?? undefined,
          })),
        } as CoachDetail;
      })()
    );
  }

  getCourse(id: string): Observable<CourseDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('courses')
          .select(
            `
            *,
            sport:sports(*),
            coach:coach_profiles(
              id, bio, avatar_url,
              user:profiles(id, name)
            ),
            location:locations(id, name, address, city, lat, lng, type),
            occurrences:course_occurrences(id, starts_at, ends_at),
            photos:course_photos(id, storage_path, display_order)
          `
          )
          .eq('id', id)
          .single();
        if (error) throw error;

        const base = this.mapCourseToProgramCourse(data);
        return {
          ...base,
          ageMin: data.age_from ?? undefined,
          ageMax: data.age_to ?? undefined,
          coachBio: data.coach?.bio ?? undefined,
          gallery: (data.photos ?? []).map((p: any) => p.storage_path),
        } as CourseDetail;
      })()
    );
  }

  getCamps(): Observable<CampSummary[]> {
    return from(
      this.supabase
        .from('camps')
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((camp: any) => this.toCampSummary(camp));
        })
    );
  }

  getCampBySlug(slug: string): Observable<CampDetail> {
    return from(
      this.supabase
        .from('camps')
        .select('*')
        .eq('slug', slug)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return this.toCampDetail(data);
        })
    );
  }

  // Activities
  getActivities(includePast = false): Observable<PublicActivitySummary[]> {
    return from(
      (async () => {
        let query = this.supabase
          .from('activities')
          .select(
            `
            *,
            sport:sports(*),
            location:locations(id, name, address, city)
          `
          )
          .eq('active', true);

        if (!includePast) {
          query = query.gte('activity_date', new Date().toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data ?? []).map((a: any) => ({
          id: a.id,
          name: a.name,
          sport: a.sport ? { id: a.sport.id, code: a.sport.code, name: a.sport.name } : { id: '', code: '', name: '' },
          activityDate: a.activity_date,
          startTime: a.start_time,
          endTime: a.end_time,
          locationId: a.location_id ?? undefined,
          location: a.location?.name ?? FALLBACK_LOCATION,
          price: a.price ?? 0,
          currency: a.currency ?? DEFAULT_CURRENCY,
          capacity: a.capacity ?? null,
          spotsLeft: null, // Would need enrollment count
          hasHeroPhoto: Boolean(a.hero_photo_storage_path),
          heroPhotoUrl: a.hero_photo_storage_path ?? null,
        }));
      })()
    );
  }

  getActivity(id: string): Observable<PublicActivityDetail> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('activities')
          .select(
            `
            *,
            sport:sports(*),
            location:locations(id, name, address, city, lat, lng, type),
            coach:coach_profiles(
              id, avatar_url,
              user:profiles(id, name)
            )
          `
          )
          .eq('id', id)
          .single();
        if (error) throw error;

        // Count enrollments
        const { count } = await this.supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('entity_type', 'ACTIVITY')
          .eq('entity_id', id)
          .eq('status', 'ACTIVE');

        const enrolledCount = count ?? 0;

        return {
          id: data.id,
          name: data.name,
          description: data.description ?? null,
          sport: data.sport ? { id: data.sport.id, code: data.sport.code, name: data.sport.name } : { id: '', code: '', name: '' },
          activityDate: data.activity_date,
          startTime: data.start_time,
          endTime: data.end_time,
          price: data.price ?? 0,
          currency: data.currency ?? DEFAULT_CURRENCY,
          capacity: data.capacity ?? null,
          spotsLeft: data.capacity != null ? Math.max(0, data.capacity - enrolledCount) : null,
          enrolledCount,
          heroPhotoUrl: data.hero_photo_storage_path ?? null,
          coach: {
            id: data.coach?.id ?? '',
            name: data.coach?.user?.name ?? '',
            avatarUrl: data.coach?.avatar_url ?? null,
          },
          location: {
            id: data.location?.id ?? '',
            name: data.location?.name ?? '',
            address: data.location?.address ?? undefined,
            city: data.location?.city ?? undefined,
            lat: data.location?.lat ?? undefined,
            lng: data.location?.lng ?? undefined,
            type: data.location?.type ?? undefined,
          },
        } as PublicActivityDetail;
      })()
    );
  }

  submitContact(message: ContactMessageRequest): Observable<void> {
    return from(this.supabase.invokeFunction<void>('contact-form', message));
  }

  // ─── Private helpers ────────────────────────────────────────

  private mapCourseToProgramCourse(row: any): ProgramCourse {
    const sport = row.sport
      ? { id: row.sport.id, code: row.sport.code, name: row.sport.name }
      : { id: '', code: '', name: '' };

    const coachProfile = row.coach;
    const coach: CoachSummary = {
      id: coachProfile?.id ?? '',
      name: coachProfile?.user?.name ?? '',
      avatarUrl: coachProfile?.avatar_url ?? undefined,
      summary: undefined,
      disciplines: [],
      locations: [],
    };

    const location: LocationSummary = {
      id: row.location?.id ?? '',
      name: row.location?.name ?? '',
      address: row.location?.address ?? undefined,
      city: row.location?.city ?? undefined,
      lat: row.location?.lat ?? undefined,
      lng: row.location?.lng ?? undefined,
      type: row.location?.type ?? undefined,
    };

    const occurrences: CourseOccurrence[] = (row.occurrences ?? []).map((occ: any) => ({
      id: occ.id,
      startTime: occ.starts_at,
      endTime: occ.ends_at,
    }));

    return {
      id: row.id,
      name: row.name,
      sport,
      price: row.price ?? 0,
      pricePerSession: row.price_per_session ?? row.price ?? 0,
      packageOptions: row.package_options ?? undefined,
      currency: row.currency ?? DEFAULT_CURRENCY,
      coach,
      location,
      occurrences,
      level: row.level ?? undefined,
      ageMin: row.age_from ?? undefined,
      ageMax: row.age_to ?? undefined,
      durationMinutes: row.duration_minutes ?? undefined,
      description: row.description ?? undefined,
      heroPhotoUrl: row.hero_photo_storage_path ?? undefined,
      capacity: row.capacity ?? undefined,
    };
  }

  private mapCoachSummary(row: any): CoachSummary {
    const sports: PublicSport[] = (row.sports ?? []).map((cs: any) => ({
      id: cs.sport?.id ?? '',
      code: cs.sport?.code ?? '',
      name: cs.sport?.name ?? '',
    }));

    return {
      id: row.id,
      name: row.user?.name ?? '',
      avatarUrl: row.avatar_url ?? undefined,
      summary: row.bio ?? undefined,
      disciplines: sports.map((s) => ({ sport: s, levels: [] })),
      locations: [],
    };
  }

  private mapClubSummary(club: any): PublicClubSummary {
    const sports: PublicClubSport[] = (club.sports ?? []).map((cs: any) => ({
      id: cs.sport?.id ?? '',
      code: cs.sport?.code ?? '',
      name: cs.sport?.name ?? '',
    }));

    return {
      id: club.id,
      name: club.name,
      description: club.description ?? undefined,
      city: club.city ?? undefined,
      website: club.website ?? undefined,
      phone: club.phone ?? undefined,
      logoUrl: club.logo_storage_path ?? undefined,
      heroPhotoUrl: club.hero_photo_storage_path ?? null,
      coachCount: (club.coaches ?? []).length,
      sports,
      email: club.email ?? undefined,
    };
  }

  private toCampSummary(camp: any): CampSummary {
    const gallery = camp.gallery_json
      ? (typeof camp.gallery_json === 'string' ? JSON.parse(camp.gallery_json) : camp.gallery_json)
      : [];
    return {
      id: camp.slug ?? camp.id,
      slug: camp.slug,
      title: camp.title,
      startDate: camp.period_start,
      endDate: camp.period_end,
      location: (camp.location_text ?? '').trim() || FALLBACK_LOCATION,
      price: camp.price ?? 0,
      currency: camp.currency ?? DEFAULT_CURRENCY,
      allowCash: Boolean(camp.allow_cash),
      heroImageUrl: camp.hero_image_url || undefined,
      summary: camp.description?.substring(0, 200) || undefined,
      description: camp.description || undefined,
      soldOut: false, // Would need enrollment count vs capacity
      capacity: camp.capacity ?? undefined,
    };
  }

  private toCampDetail(camp: any): CampDetail {
    const summary = this.toCampSummary(camp);
    const rawGallery = camp.gallery_json
      ? (typeof camp.gallery_json === 'string' ? JSON.parse(camp.gallery_json) : camp.gallery_json)
      : [];
    return {
      ...summary,
      gallery: (rawGallery as string[]).map((item) => item.trim()).filter((item) => item.length > 0),
    };
  }
}
