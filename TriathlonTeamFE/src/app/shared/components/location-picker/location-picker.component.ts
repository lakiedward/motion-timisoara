import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  forwardRef,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LocationService, LocationDto, CreateLocationRequest, LocationTypeOption } from '../../../core/services/location.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './location-picker.component.html',
  styleUrls: ['./location-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LocationPickerComponent),
      multi: true
    }
  ]
})
export class LocationPickerComponent implements OnInit, OnDestroy, ControlValueAccessor {
  private readonly locationService = inject(LocationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  // Inputs
  @Input() label = 'Locație';
  @Input() placeholder = 'Caută sau selectează locație...';
  @Input() required = false;
  @Input() defaultCity?: string;
  @Input() showCityFilter = true;
  @Input() showLabel = true;
  @Input() enableMapPicker = false;
  @Input() mapExpandedByDefault = false;

  // Outputs
  @Output() locationSelected = new EventEmitter<LocationDto>();

  // State
  readonly selectedLocation = signal<LocationDto | null>(null);
  readonly selectedCity = signal<string>('');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal(false);
  readonly showDropdown = signal(false);
  readonly showCreateForm = signal(false);
  readonly showMapPanel = signal(false);

  // Data
  readonly cities = signal<string[]>([]);
  readonly recentLocations = signal<LocationDto[]>([]);
  readonly searchResults = signal<LocationDto[]>([]);
  readonly allLocationsInCity = signal<LocationDto[]>([]);

  readonly mapCity = signal<string>('');
  readonly mapQuery = signal<string>('');
  readonly mapLocations = signal<LocationDto[]>([]);
  readonly mapIsLoading = signal(false);
  readonly mapError = signal<string | null>(null);

  readonly mapElementId = `location-picker-map-${Math.random().toString(36).slice(2, 10)}`;

  @ViewChild('mapPickerPanel') mapPickerPanel?: ElementRef;

  private mapInstance: any | null = null;
  private mapMarkers: Map<string, any> = new Map();
  private mapMarkersGroup: any | null = null;

  // Combined locations for display
  readonly displayLocations = computed(() => {
    const recent = this.recentLocations();
    const search = this.searchResults();
    const all = this.allLocationsInCity();
    const query = this.searchQuery();

    // If searching, show search results
    if (query.length >= 2) {
      return { recent: [], results: search, showRecent: false };
    }

    // Otherwise show recent + all in city
    const recentIds = new Set(recent.map(l => l.id));
    const filtered = all.filter(l => !recentIds.has(l.id));

    return {
      recent,
      results: filtered,
      showRecent: recent.length > 0
    };
  });

  // Search subject for debounce
  private searchSubject = new Subject<string>();

  readonly filteredMapLocations = computed(() => {
    const city = (this.mapCity() ?? '').trim();
    const query = (this.mapQuery() ?? '').trim().toLowerCase();
    const all = this.mapLocations();

    let filtered = all;
    if (city) {
      const cityKey = city.toLowerCase();
      filtered = filtered.filter((l) => (l.city ?? '').toLowerCase() === cityKey);
    }

    if (query.length >= 2) {
      filtered = filtered.filter((l) => {
        const hay = `${l.name ?? ''} ${l.address ?? ''} ${l.city ?? ''}`.toLowerCase();
        return hay.includes(query);
      });
    }

    return filtered;
  });

  private readonly mapMarkersEffect = effect(() => {
    if (!this.enableMapPicker) {
      return;
    }
    if (!this.showMapPanel()) {
      return;
    }
    this.filteredMapLocations();
    queueMicrotask(() => this.refreshMapMarkers());
  });

  // Form control callbacks
  private onChange: (value: string | null) => void = () => { };
  private onTouched: () => void = () => { };

  // Create form state
  newLocation: CreateLocationRequest = {
    name: '',
    city: '',
    address: '',
    type: 'OTHER',
    lat: undefined,
    lng: undefined
  };
  selectedType = 'OTHER';
  readonly locationTypes: LocationTypeOption[] = this.locationService.locationTypes;

  ngOnInit(): void {
    this.loadCities();
    this.setupSearch();

    if (this.defaultCity) {
      this.selectedCity.set(this.defaultCity);
      this.loadLocationsForCity(this.defaultCity);
    } else {
      // When no city is selected, allow usage via global search + show recent locations across all cities
      this.loadRecentLocations();
    }

    if (this.enableMapPicker && this.mapExpandedByDefault) {
      this.openMapPanel();
    }
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
    this.destroyMap();
  }

  private loadCities(): void {
    this.locationService.getCities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cities => {
        this.cities.set(cities);
      });
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          return of([]);
        }
        this.isLoading.set(true);
        const city = this.selectedCity() || undefined;
        return this.locationService.searchLocations(city, query).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe(results => {
      this.searchResults.set(results);
      this.isLoading.set(false);
    });
  }

  onCityChange(city: string): void {
    this.selectedCity.set(city);
    this.searchQuery.set('');
    this.searchResults.set([]);

    if (city) {
      this.loadLocationsForCity(city);
    } else {
      this.allLocationsInCity.set([]);
      this.loadRecentLocations();
    }
  }

  private loadLocationsForCity(city: string): void {
    this.isLoading.set(true);

    forkJoin({
      recent: this.locationService.getRecentLocations(city, 5).pipe(catchError(() => of([]))),
      all: this.locationService.getByCity(city).pipe(catchError(() => of([])))
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ recent, all }) => {
        this.recentLocations.set(recent);
        this.allLocationsInCity.set(all);
        this.isLoading.set(false);
      });
  }

  private loadRecentLocations(city?: string): void {
    this.isLoading.set(true);
    this.locationService
      .getRecentLocations(city, 5)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of([]))
      )
      .subscribe((recent) => {
        this.recentLocations.set(recent);
        this.isLoading.set(false);
      });
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  selectLocation(location: LocationDto): void {
    this.selectedLocation.set(location);
    if (location.city) {
      this.selectedCity.set(location.city);
    }
    this.showDropdown.set(false);
    this.searchQuery.set('');

    // Update form control
    this.onChange(location.id);
    this.onTouched();

    // Emit event
    this.locationSelected.emit(location);

    // Track usage
    this.locationService.trackUsage(location.id).subscribe();
  }

  toggleMapPanel(): void {
    if (this.showMapPanel()) {
      this.closeMapPanel();
      return;
    }
    this.openMapPanel();
  }

  openMapPanel(): void {
    if (!this.enableMapPicker) {
      return;
    }
    this.showDropdown.set(false);
    this.showMapPanel.set(true);

    const initialCity =
      this.selectedLocation()?.city || this.defaultCity || this.selectedCity() || '';
    if (!this.mapCity()) {
      this.mapCity.set(initialCity);
    }

    this.loadMapLocations();
  }

  closeMapPanel(): void {
    this.showMapPanel.set(false);
    this.destroyMap();
  }

  onMapCityChange(city: string): void {
    this.mapCity.set(city);
    this.loadMapLocations();
  }

  onMapSearchInput(value: string): void {
    this.mapQuery.set(value);
  }

  focusLocationOnMap(location: LocationDto): void {
    const lat = location.lat;
    const lng = location.lng;
    if (!this.mapInstance || lat == null || lng == null) {
      this.selectLocationFromMap(location);
      return;
    }
    try {
      this.mapInstance.setView([lat, lng], 15, { animate: true });
      const marker = this.mapMarkers.get(location.id);
      marker?.openPopup?.();
    } catch {
      this.selectLocationFromMap(location);
    }
  }

  mapZoomIn(): void {
    try {
      this.mapInstance?.zoomIn?.();
    } catch {
      return;
    }
  }

  mapZoomOut(): void {
    try {
      this.mapInstance?.zoomOut?.();
    } catch {
      return;
    }
  }

  mapResetView(): void {
    try {
      if (this.mapInstance && this.mapMarkersGroup?.getBounds) {
        this.mapInstance.fitBounds(this.mapMarkersGroup.getBounds().pad(0.1));
      }
    } catch {
      return;
    }
  }

  pickLocationFromMap(location: LocationDto): void {
    this.selectLocationFromMap(location);
  }

  private selectLocationFromMap(location: LocationDto): void {
    this.selectLocation(location);
    this.closeMapPanel();
  }

  private loadMapLocations(): void {
    if (!this.enableMapPicker) {
      return;
    }
    if (!this.showMapPanel()) {
      return;
    }

    this.mapIsLoading.set(true);
    this.mapError.set(null);

    const city = (this.mapCity() || '').trim() || undefined;
    this.locationService
      .searchLocations(city, undefined)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.mapError.set('Nu am putut încărca locațiile.');
          return of([] as LocationDto[]);
        })
      )
      .subscribe((locations) => {
        this.mapLocations.set(locations ?? []);
        this.mapIsLoading.set(false);
        setTimeout(() => {
          void this.ensureMapInitialized();
        }, 0);
      });
  }

  private async ensureMapInitialized(): Promise<void> {
    if (!this.enableMapPicker) return;
    if (!this.showMapPanel()) return;
    if (!isPlatformBrowser(this.platformId)) return;

    const L = await this.ensureLeaflet();
    if (!L) return;

    const el = document.getElementById(this.mapElementId);
    if (!el) return;

    if (this.mapInstance) {
      try {
        this.mapInstance.remove();
      } catch {
        // ignore
      }
      this.mapInstance = null;
    }

    const selected = this.selectedLocation();
    const selectedCenter: [number, number] | null =
      selected?.lat != null && selected?.lng != null ? [selected.lat, selected.lng] : null;
    const firstWithCoords = this.mapLocations().find((l) => l.lat != null && l.lng != null);
    const fallbackCenter: [number, number] = firstWithCoords?.lat != null && firstWithCoords?.lng != null
      ? [firstWithCoords.lat, firstWithCoords.lng]
      : [45.7489, 21.2087];

    const center = selectedCenter ?? fallbackCenter;

    this.mapInstance = L.map(el, { zoomControl: false, scrollWheelZoom: true }).setView(center, 13);

    L.control.zoom({ position: 'topright' }).addTo(this.mapInstance);

    const roBounds = L.latLngBounds([43.6, 20.2], [48.4, 29.9]);
    this.mapInstance.setMaxBounds(roBounds);
    this.mapInstance.options.maxBoundsViscosity = 0.7;

    const layer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(this.mapInstance);

    layer.once('load', () => {
      setTimeout(() => {
        try {
          this.mapInstance?.invalidateSize?.(false);
        } catch {
          return;
        }
      }, 0);
    });

    this.refreshMapMarkers();

    setTimeout(() => {
      try {
        this.mapInstance?.invalidateSize?.(false);
      } catch {
        return;
      }
    }, 50);
  }

  private async ensureLeaflet(): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const hasLeaflet = () => typeof window !== 'undefined' && !!(window as any).L;
    if (hasLeaflet()) {
      return (window as any).L;
    }

    return new Promise((resolve) => {
      let attempts = 100;
      const timer = setInterval(() => {
        if (hasLeaflet() || attempts-- <= 0) {
          clearInterval(timer);
          resolve((window as any).L || null);
        }
      }, 100);
    });
  }

  private async refreshMapMarkers(): Promise<void> {
    if (!this.mapInstance) {
      return;
    }
    const L = await this.ensureLeaflet();
    if (!L) {
      return;
    }

    this.mapMarkers.forEach((m) => {
      try {
        m.remove();
      } catch {
        return;
      }
    });
    this.mapMarkers.clear();
    this.mapMarkersGroup = null;

    const candidates = this.filteredMapLocations();
    const markersArray: any[] = [];

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin"><span>📍</span></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    for (const loc of candidates) {
      if (loc.lat == null || loc.lng == null) {
        continue;
      }

      const popupContent = document.createElement('div');
      popupContent.className = 'map-popup';

      const title = document.createElement('h3');
      title.className = 'map-popup__title';
      title.textContent = loc.name;
      popupContent.appendChild(title);

      const address = document.createElement('p');
      address.className = 'map-popup__address';
      address.textContent = `${loc.city || ''} ${loc.address || ''}`.trim();
      popupContent.appendChild(address);

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).bindPopup(
        popupContent,
        { minWidth: 220, maxWidth: 320, className: 'custom-popup' }
      );

      marker.on('click', () => {
        this.ngZone.run(() => this.selectLocationFromMap(loc));
      });

      marker.addTo(this.mapInstance);
      this.mapMarkers.set(loc.id, marker);
      markersArray.push(marker);
    }

    if (markersArray.length > 0) {
      this.mapMarkersGroup = L.featureGroup(markersArray);
      try {
        this.mapInstance.fitBounds(this.mapMarkersGroup.getBounds().pad(0.1));
      } catch {
        return;
      }
    }
  }

  private destroyMap(): void {
    this.mapMarkers.forEach((m) => {
      try {
        m.remove();
      } catch {
        return;
      }
    });
    this.mapMarkers.clear();
    this.mapMarkersGroup = null;

    if (this.mapInstance) {
      try {
        this.mapInstance.remove();
      } catch {
        // ignore
      }
      this.mapInstance = null;
    }
  }

  clearSelection(): void {
    this.selectedLocation.set(null);
    this.onChange(null);
    this.onTouched();
  }

  openDropdown(): void {
    this.showDropdown.set(true);
  }

  closeDropdown(): void {
    // Small delay to allow click events
    setTimeout(() => {
      this.showDropdown.set(false);
    }, 200);
  }

  // Create new location
  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.showDropdown.set(false);
    this.newLocation = {
      name: this.searchQuery() || '',
      city: this.selectedCity() || '',
      address: '',
      type: 'OTHER',
      lat: undefined,
      lng: undefined
    };
    this.selectedType = 'OTHER';
  }

  openCreateLocationPage(): void {
    // Keep the current page state (e.g. course form) intact by opening in a new tab.
    // Detect area based on current URL so this component works in club/coach/admin contexts.
    const url = this.router.url || '';
    const area = url.startsWith('/club') ? 'club' : url.startsWith('/coach') ? 'coach' : url.startsWith('/admin') ? 'admin' : null;

    if (!area || typeof window === 'undefined') {
      // Fallback to the inline modal if we can't infer context (or not in browser)
      this.openCreateForm();
      return;
    }

    window.open(`/${area}/locations/new`, '_blank');
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  saveNewLocation(): void {
    if (!this.newLocation.name?.trim()) return;

    this.isLoading.set(true);

    const name = this.newLocation.name.trim();
    const cityRaw = (this.newLocation.city ?? '').trim();
    const addressRaw = (this.newLocation.address ?? '').trim();

    const request: CreateLocationRequest = {
      ...this.newLocation,
      name,
      city: cityRaw || undefined,
      address: addressRaw || undefined,
      type: this.selectedType
    };

    this.locationService.createLocation(request).subscribe({
      next: (location) => {
        this.selectLocation(location);
        this.showCreateForm.set(false);
        this.isLoading.set(false);

        // Refresh city list and locations
        this.loadCities();
        if (location.city) {
          this.selectedCity.set(location.city);
          this.loadLocationsForCity(location.city);
        }
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  // ControlValueAccessor implementation
  writeValue(locationId: string | null): void {
    if (locationId) {
      this.locationService.getById(locationId).subscribe({
        next: (location) => {
          this.selectedLocation.set(location);
          if (location.city) {
            this.selectedCity.set(location.city);
          }
        },
        error: () => {
          this.selectedLocation.set(null);
        }
      });
    } else {
      this.selectedLocation.set(null);
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  // Helper methods
  getTypeIcon(type: string): string {
    return this.locationService.getTypeIcon(type);
  }

  getTypeLabel(type: string): string {
    return this.locationService.getTypeLabel(type);
  }
}
