import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CoachApiService, LocationOption } from './coach-api.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly api = inject(CoachApiService);

  getAll(): Observable<LocationOption[]> {
    return this.api.getLocations();
  }
}
