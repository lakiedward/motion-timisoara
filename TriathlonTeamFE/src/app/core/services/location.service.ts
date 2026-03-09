import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface LocationDto {
  id: string;
  name: string;
  city?: string;
  address?: string;
  type: string;
  lat?: number;
  lng?: number;
  description?: string;
  capacity?: number;
  createdByUserId?: string;
  clubId?: string;
  isActive?: boolean;
}

export interface CreateLocationRequest {
  name: string;
  city?: string;
  address?: string;
  type?: string;
  lat?: number;
  lng?: number;
  description?: string;
  capacity?: number;
}

export interface UpdateLocationRequest {
  name?: string;
  city?: string;
  address?: string;
  type?: string;
  lat?: number;
  lng?: number;
  description?: string;
  capacity?: number;
  isActive?: boolean;
}

export type LocationType = 'POOL' | 'GYM' | 'OUTDOOR' | 'TRACK' | 'OTHER';

export interface LocationTypeOption {
  value: LocationType;
  label: string;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/locations';
  
  // Cache for cities
  private citiesCache$?: Observable<string[]>;

  // Location type options
  readonly locationTypes: LocationTypeOption[] = [
    { value: 'POOL', label: 'Bazin', icon: 'pool' },
    { value: 'GYM', label: 'Sală de sport', icon: 'fitness_center' },
    { value: 'OUTDOOR', label: 'În aer liber', icon: 'park' },
    { value: 'TRACK', label: 'Pistă de alergare', icon: 'directions_run' },
    { value: 'OTHER', label: 'Altele', icon: 'location_on' }
  ];

  /**
   * Get all cities that have locations
   */
  getCities(): Observable<string[]> {
    if (!this.citiesCache$) {
      this.citiesCache$ = this.http.get<string[]>(`${this.baseUrl}/cities`).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        catchError(() => of([]))
      );
    }
    return this.citiesCache$;
  }

  /**
   * Clear cities cache (call when creating a new location in a new city)
   */
  clearCitiesCache(): void {
    this.citiesCache$ = undefined;
  }

  /**
   * Search locations with optional filters
   */
  searchLocations(city?: string, query?: string): Observable<LocationDto[]> {
    const params: any = {};
    if (city) params.city = city;
    if (query) params.query = query;
    
    return this.http.get<LocationDto[]>(`${this.baseUrl}/search`, { params });
  }

  /**
   * Get locations by city
   */
  getByCity(city: string): Observable<LocationDto[]> {
    return this.http.get<LocationDto[]>(`${this.baseUrl}/by-city/${encodeURIComponent(city)}`);
  }

  /**
   * Get a specific location by ID
   */
  getById(id: string): Observable<LocationDto> {
    return this.http.get<LocationDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get user's recent locations
   */
  getRecentLocations(city?: string, limit: number = 10): Observable<LocationDto[]> {
    const params: any = { limit };
    if (city) params.city = city;
    
    return this.http.get<LocationDto[]>(`${this.baseUrl}/recent`, { 
      params, 
      withCredentials: true 
    }).pipe(
      catchError(() => of([])) // Return empty if not authenticated
    );
  }

  /**
   * Find similar locations (for deduplication)
   */
  findSimilar(city: string, name: string): Observable<LocationDto[]> {
    return this.http.get<LocationDto[]>(`${this.baseUrl}/similar`, {
      params: { city, name }
    });
  }

  /**
   * Create a new location
   */
  createLocation(request: CreateLocationRequest): Observable<LocationDto> {
    return this.http.post<LocationDto>(this.baseUrl, request, { withCredentials: true }).pipe(
      tap(() => {
        // Clear cache if new city
        if (request.city) {
          this.clearCitiesCache();
        }
      })
    );
  }

  updateLocation(id: string, request: UpdateLocationRequest): Observable<LocationDto> {
    return this.http
      .put<LocationDto>(`${this.baseUrl}/${id}`, request, { withCredentials: true })
      .pipe(
        tap(() => {
          this.clearCitiesCache();
        })
      );
  }

  deleteLocation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true }).pipe(
      tap(() => {
        this.clearCitiesCache();
      })
    );
  }

  /**
   * Track that user used a location
   */
  trackUsage(locationId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${locationId}/track-usage`, {}, { 
      withCredentials: true 
    }).pipe(
      catchError(() => of(undefined)) // Silently fail if not authenticated
    );
  }

  /**
   * Get type label for a location type
   */
  getTypeLabel(type: string): string {
    const found = this.locationTypes.find(t => t.value === type);
    return found?.label ?? type;
  }

  /**
   * Get type icon for a location type
   */
  getTypeIcon(type: string): string {
    const found = this.locationTypes.find(t => t.value === type);
    return found?.icon ?? 'location_on';
  }
}
