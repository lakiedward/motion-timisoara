import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

export interface ReverseResult {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://nominatim.openstreetmap.org';

  search(query: string): Observable<GeocodeResult[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('format', 'jsonv2')
      .set('addressdetails', '1')
      .set('limit', '6')
      .set('accept-language', 'ro')
      .set('countrycodes', 'ro');
    const headers = new HttpHeaders({ 'X-Skip-Auth': 'true', Accept: 'application/json' });
    return this.http.get<GeocodeResult[]>(`${this.base}/search`, { params, headers });
  }

  reverse(lat: number, lon: number): Observable<ReverseResult> {
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lon', String(lon))
      .set('format', 'jsonv2')
      .set('addressdetails', '1')
      .set('accept-language', 'ro');
    const headers = new HttpHeaders({ 'X-Skip-Auth': 'true', Accept: 'application/json' });
    return this.http.get<ReverseResult>(`${this.base}/reverse`, { params, headers });
  }
}
