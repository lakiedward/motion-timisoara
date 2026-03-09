import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminLocation, AdminLocationPayload } from './models/admin-location.model';

@Injectable({ providedIn: 'root' })
export class AdminLocationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/locations';

  getAll(): Observable<AdminLocation[]> {
    return this.http.get<AdminLocation[]>(this.baseUrl);
  }

  getById(id: string): Observable<AdminLocation> {
    return this.http.get<AdminLocation>(`${this.baseUrl}/${id}`);
  }

  create(payload: AdminLocationPayload): Observable<AdminLocation> {
    return this.http.post<AdminLocation>(this.baseUrl, payload);
  }

  update(id: string, payload: AdminLocationPayload): Observable<AdminLocation> {
    return this.http.put<AdminLocation>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

