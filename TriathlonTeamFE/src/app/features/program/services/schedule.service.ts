import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  ProgramCourse,
  PagedResponse,
  ScheduleFilters,
  CoachSummary,
  LocationSummary,
  CourseOccurrence,
} from '../../../core/services/public-api.service';

const DEFAULT_CURRENCY = 'RON';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly supabase = inject(SupabaseService);

  fetchSchedule(filters: ScheduleFilters): Observable<PagedResponse<ProgramCourse>> {
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
        if (filters.dayOfWeek != null) {
          // dayOfWeek filtering requires post-query filtering or a DB function.
          // For now we fetch all and filter in memory.
        }

        const { data, error, count } = await query;
        if (error) throw error;

        let rows = data ?? [];

        // Client-side dayOfWeek filter: keep courses that have at least one
        // occurrence on the requested day
        if (filters.dayOfWeek != null) {
          const targetDay = filters.dayOfWeek;
          rows = rows.filter((row: any) =>
            (row.occurrences ?? []).some((occ: any) => {
              const dt = new Date(occ.starts_at);
              return dt.getDay() === targetDay;
            })
          );
        }

        const totalElements = count ?? 0;
        const totalPages = Math.ceil(totalElements / size);

        const content: ProgramCourse[] = rows.map((row: any) =>
          this.mapCourseToProgramCourse(row)
        );

        return { content, totalElements, totalPages, page, size };
      })()
    );
  }

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
}
