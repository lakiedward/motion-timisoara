import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';

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

interface CampApiResponse {
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  locationText?: string;
  capacity?: number;
  price: number;
  currency?: string; // optional in API; defaulted to RON when missing
  soldOut?: boolean;
  allowCash: boolean;
  heroImageUrl?: string;
  gallery?: string[];
}

// Backend response interfaces
interface ScheduleItemResponse {
  course: PublicCourseDtoResponse;
  coach: PublicCoachDtoResponse;
  location: PublicLocationDtoResponse;
  nextOccurrences: string[];
}

interface PublicCourseDtoResponse {
  id: string;
  name: string;
  sport: PublicSport;
  level?: string;
  ageFrom?: number;
  ageTo?: number;
  capacity?: number;
  price: number;
  pricePerSession?: number;
  packageOptions?: string;
  currency?: string; // optional; defaulted to RON if missing
  active: boolean;
  durationMinutes?: number;
  description?: string;
  heroPhotoUrl?: string;
  averageRating?: number;
  totalRatings?: number;
}

interface PublicCoachDtoResponse {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface PublicLocationDtoResponse {
  id: string;
  name: string;
}

interface PublicScheduleResponse {
  content: ScheduleItemResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

const DEFAULT_CURRENCY = 'RON';
const FALLBACK_LOCATION = 'Locatie in curs de confirmare';

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/public';

  // Cache for locations to prevent multiple requests
  private locationsCache$?: Observable<LocationSummary[]>;
  private sportsCache$?: Observable<PublicSport[]>;

  getSchedule(filters: ScheduleFilters = {}): Observable<PagedResponse<ProgramCourse>> {
    const params = this.buildParams(filters);
    return this.http.get<PublicScheduleResponse>(`${this.baseUrl}/schedule`, { params })
      .pipe(map(response => this.mapScheduleResponse(response)));
  }

  getPublicSports(): Observable<PublicSport[]> {
    if (!this.sportsCache$) {
      this.sportsCache$ = this.http.get<PublicSport[]>(`${this.baseUrl}/sports`).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.sportsCache$;
  }

  getPublicLocations(): Observable<LocationSummary[]> {
    if (!this.locationsCache$) {
      this.locationsCache$ = this.http.get<LocationSummary[]>(`${this.baseUrl}/locations`).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.locationsCache$;
  }

  getCoaches(filters: CoachFilters = {}): Observable<CoachSummary[]> {
    const params = this.buildParams(filters);
    return this.http.get<CoachSummary[]>(`${this.baseUrl}/coaches`, { params });
  }

  getPublicClubs(): Observable<PublicClubSummary[]> {
    return this.http.get<PublicClubSummary[]>(`${this.baseUrl}/clubs`);
  }

  getPublicClub(id: string): Observable<PublicClubDetail> {
    return this.http.get<PublicClubDetail>(`${this.baseUrl}/clubs/${id}`);
  }

  getCoach(id: string): Observable<CoachDetail> {
    return this.http.get<CoachDetail>(`${this.baseUrl}/coaches/${id}`);
  }

  getCourse(id: string): Observable<CourseDetail> {
    return this.http.get<any>(`${this.baseUrl}/courses/${id}`)
      .pipe(map(response => this.mapCourseDetailResponse(response)));
  }

  getCamps(): Observable<CampSummary[]> {
    return this.http
      .get<CampApiResponse[]>(`${this.baseUrl}/camps`)
      .pipe(map((response) => (response ?? []).map((item) => this.toCampSummary(item))));
  }

  getCampBySlug(slug: string): Observable<CampDetail> {
    return this.http
      .get<CampApiResponse>(`${this.baseUrl}/camps/${slug}`)
      .pipe(map((response) => this.toCampDetail(response)));
  }

  // Activities
  getActivities(includePast = false): Observable<PublicActivitySummary[]> {
    const params = includePast ? new HttpParams().set('includePast', 'true') : undefined;
    return this.http.get<PublicActivitySummary[]>(`${this.baseUrl}/activities`, params ? { params } : {});
  }

  getActivity(id: string): Observable<PublicActivityDetail> {
    return this.http.get<PublicActivityDetail>(`${this.baseUrl}/activities/${id}`);
  }

  submitContact(message: ContactMessageRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/contact`, message);
  }

  private buildParams(filters: ScheduleFilters): HttpParams {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          params = params.append(key, String(entry));
        });
      } else {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  private toCampSummary(dto: CampApiResponse): CampSummary {
    return {
      id: dto.slug,
      slug: dto.slug,
      title: dto.title,
      startDate: dto.periodStart,
      endDate: dto.periodEnd,
      location: dto.locationText?.trim() || FALLBACK_LOCATION,
      price: dto.price ?? 0,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      allowCash: dto.allowCash,
      heroImageUrl: dto.heroImageUrl || undefined,
      summary: dto.summary || undefined,
      description: dto.description || undefined,
      soldOut: Boolean(dto.soldOut),
      capacity: dto.capacity
    };
  }

  private toCampDetail(dto: CampApiResponse): CampDetail {
    const summary = this.toCampSummary(dto);
    return {
      ...summary,
      gallery: (dto.gallery ?? []).map((item) => item.trim()).filter((item) => item.length > 0)
    };
  }

  private mapScheduleResponse(response: PublicScheduleResponse): PagedResponse<ProgramCourse> {
    return {
      content: response.content.map(item => this.mapScheduleItemToProgramCourse(item)),
      totalElements: response.totalElements,
      totalPages: response.totalPages,
      page: response.page,
      size: response.size
    };
  }

  private mapScheduleItemToProgramCourse(item: ScheduleItemResponse): ProgramCourse {
    const course = item.course;
    const coach = item.coach;
    const location = item.location;

    return {
      id: course.id,
      name: course.name,
      sport: course.sport,
      price: course.price,
      pricePerSession: course.pricePerSession ?? course.price,
      packageOptions: course.packageOptions,
      currency: course.currency ?? DEFAULT_CURRENCY,
      coach: {
        id: coach.id,
        name: coach.name,
        avatarUrl: coach.avatarUrl,
        summary: undefined,
        disciplines: [],
        locations: []
      },
      location: {
        id: location.id,
        name: location.name
      },
      occurrences: item.nextOccurrences.map(dateStr => {
        const startIso = dateStr;
        let endIso = '';
        // Compute an approximate end time if duration is available
        if (course.durationMinutes && Number.isFinite(course.durationMinutes)) {
          const startDate = new Date(startIso);
          if (!Number.isNaN(startDate.getTime())) {
            const endDate = new Date(startDate.getTime() + course.durationMinutes * 60_000);
            endIso = endDate.toISOString();
          }
        }
        return {
          id: '', // Not provided by backend
          startTime: startIso,
          endTime: endIso
        };
      }),
      level: course.level as CourseLevel,
      ageMin: course.ageFrom,
      ageMax: course.ageTo,
      durationMinutes: course.durationMinutes,
      description: course.description,
      heroPhotoUrl: course.heroPhotoUrl,
      capacity: course.capacity,
      averageRating: course.averageRating,
      totalRatings: course.totalRatings
    };
  }

  private mapCourseDetailResponse(response: any): CourseDetail {
    // Map backend field names (ageFrom/ageTo) to frontend field names (ageMin/ageMax)
    return {
      ...response,
      ageMin: response.ageFrom,
      ageMax: response.ageTo
    };
  }
}
