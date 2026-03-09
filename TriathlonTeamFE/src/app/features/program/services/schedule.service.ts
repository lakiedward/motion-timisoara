import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ProgramCourse,
  PagedResponse,
  ScheduleFilters
} from '../../../core/services/public-api.service';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/public/schedule';

  fetchSchedule(filters: ScheduleFilters): Observable<PagedResponse<ProgramCourse>> {
    const params = this.buildParams(filters);
    return this.http.get<PagedResponse<ProgramCourse>>(this.baseUrl, { params });
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
}
