import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Sport, CreateSportRequest, UpdateSportRequest } from './models/sport.model';

@Injectable({
  providedIn: 'root'
})
export class SportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/sports';
  private readonly publicUrl = '/api/public/sports';

  getSports(): Observable<Sport[]> {
    // Use public endpoint for read-only consumption (works for both coach/admin)
    return this.http.get<Sport[]>(this.publicUrl);
  }

  createSport(request: CreateSportRequest): Observable<Sport> {
    return this.http.post<Sport>(this.baseUrl, request);
  }

  updateSport(id: string, request: UpdateSportRequest): Observable<Sport> {
    return this.http.put<Sport>(`${this.baseUrl}/${id}`, request);
  }

  deleteSport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}



