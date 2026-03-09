import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, AfterViewInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminLocationService } from '../../services/admin-location.service';
import {
  AdminLocation,
  AdminLocationPayload,
  AdminLocationType
} from '../../services/models/admin-location.model';
import { GeocodingService, GeocodeResult } from '../../services/geocoding.service';

@Component({
  selector: 'app-admin-location-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './admin-location-form.component.html',
  styleUrls: ['./admin-location-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLocationFormComponent implements OnInit, AfterViewInit {
  private readonly api = inject(AdminLocationService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly geo = inject(GeocodingService);

  readonly locationId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly isSaving = signal(false);
  readonly isMapReady = signal(false);

  readonly types: { label: string; value: AdminLocationType }[] = [
    { label: 'Bazin', value: 'POOL' },
    { label: 'Pista', value: 'TRACK' },
    { label: 'Sala', value: 'GYM' },
    { label: 'Alta', value: 'OTHER' }
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['POOL' as AdminLocationType, Validators.required],
    address: [''],
    lat: [''],
    lng: ['']
  });

  private map: any | null = null;
  private marker: any | null = null;
  private reverseTimer: any = null;
  searchQuery = '';
  readonly searchResults = signal<GeocodeResult[]>([]);

  readonly isEditMode = computed(() => Boolean(this.locationId()));

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.locationId.set(id);
      this.loadData(id);
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.ensureLeaflet().then(() => {
      // Use setTimeout to ensure DOM is fully ready before map init
      setTimeout(() => {
        this.initMap();
        // Sync marker when user types lat/lng manually
        this.form
          .get('lat')!
          .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.onLatLngInputChanged());
        this.form
          .get('lng')!
          .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.onLatLngInputChanged());
      }, 100);
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: AdminLocationPayload = {
      name: this.form.value.name!,
      type: this.form.value.type!,
      address: this.form.value.address || undefined,
      lat: this.parseNumber(this.form.value.lat),
      lng: this.parseNumber(this.form.value.lng)
    };

    this.isSaving.set(true);
    const locationId = this.locationId();
    const request = locationId
      ? this.api.update(locationId, payload)
      : this.api.create(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.snackbar.open(
          locationId ? 'Locatia a fost actualizata cu succes' : 'Locatia a fost creata cu succes',
          undefined,
          { duration: 4000 }
        );
        void this.router.navigate(['/admin/locations']);
      },
      error: () => {
        this.isSaving.set(false);
        this.snackbar.open('Nu am putut salva locatia', undefined, { duration: 4000 });
      }
    });
  }

  onCancel(): void {
    void this.router.navigate(['/admin/locations']);
  }

  // Search UI
  onSearchInput(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.searchQuery = target.value;
  }

  triggerSearch(): void {
    const q = this.searchQuery.trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }
    this.geo
      .search(q)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => this.searchResults.set(results ?? []),
        error: () => this.searchResults.set([])
      });
  }

  applySearchResult(result: GeocodeResult): void {
    this.searchResults.set([]);
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      this.map?.setView([lat, lng], 15);
      this.setMarker(lat, lng, true);
      this.updateFormFromCoords(lat, lng);
      // Also put address text into the form
      this.form.patchValue({ address: result.display_name }, { emitEvent: false });
    }
  }

  private loadData(locationId: string | null): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    if (!locationId) {
      // Create mode: keep page usable and show empty form
      this.isLoading.set(false);
      return;
    }

    this.api
      .getById(locationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (location: AdminLocation) => {
          this.form.patchValue({
            name: location.name,
            type: location.type,
            address: location.address || '',
            lat: location.lat?.toString() || '',
            lng: location.lng?.toString() || ''
          });
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.isLoading.set(false);
        }
      });
  }

  private parseNumber(value: unknown): number | null {
    const str = String(value ?? '').trim();
    if (!str) {
      return null;
    }
    const num = Number(str);
    return isNaN(num) ? null : num;
  }

  private initMap(): void {
    const L = (window as any).L;
    const el = document.getElementById('admin-location-form-map');
    if (!L || !el) {
      return;
    }
    const defaultCenter = [45.7489, 21.2087]; // Timisoara
    this.isMapReady.set(false);
    this.map = L.map(el, { zoomControl: false }).setView(defaultCenter, 12);

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Limit map to Romania bounds (approx)
    const roBounds = L.latLngBounds([43.6, 20.2], [48.4, 29.9]);
    this.map.setMaxBounds(roBounds);
    (this.map as any).options.maxBoundsViscosity = 0.7;

    // Use CartoDB Voyager tiles for nicer visuals (consistent with /harta)
    const layer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(this.map);

    layer.once('load', () => {
      this.isMapReady.set(true);
      setTimeout(() => {
        try {
          this.map?.invalidateSize(false);
        } catch {}
      }, 0);
    });

    // Uber-like: update coords from map center
    this.map.on('moveend', () => {
      const center = this.map.getCenter();
      this.setMarker(center.lat, center.lng, true);
      this.debouncedReverse(center.lat, center.lng);
    });

    // Fix sizing if the container was laid out after init
    setTimeout(() => {
      try {
        this.map?.invalidateSize(false);
      } catch {}
    }, 50);

    // If form already has coords, show marker
    const lat = this.parseNumber(this.form.value.lat);
    const lng = this.parseNumber(this.form.value.lng);
    if (lat !== null && lng !== null) {
      this.setMarker(lat, lng, false);
      this.map.setView([lat, lng], 14);
    }
  }

  private onLatLngInputChanged(): void {
    const lat = this.parseNumber(this.form.value.lat);
    const lng = this.parseNumber(this.form.value.lng);
    if (lat !== null && lng !== null) {
      this.setMarker(lat, lng, false);
    }
  }

  private setMarker(lat: number, lng: number, fromMap: boolean): void {
    const L = (window as any).L;
    if (!this.map || !L) return;
    if (!this.marker) {
      // Custom marker icon consistent with /harta page
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-pin"><span>📍</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      this.marker = L.marker([lat, lng], { draggable: true, icon: customIcon }).addTo(this.map);
      this.marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        this.updateFormFromCoords(pos.lat, pos.lng);
        this.debouncedReverse(pos.lat, pos.lng);
      });
    }
    this.marker.setLatLng([lat, lng]);
    if (fromMap) {
      this.updateFormFromCoords(lat, lng);
    }
  }

  private updateFormFromCoords(lat: number, lng: number): void {
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    this.form.patchValue({ lat: latStr, lng: lngStr }, { emitEvent: false });
  }

  private ensureLeaflet(): Promise<any> {
    const hasLeaflet = () => !!(window as any).L;
    const loadAssets = () => {
      // Inject CSS if missing
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
      // Inject JS if missing
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.crossOrigin = '';
        script.defer = true;
        document.body.appendChild(script);
      }
    };

    return new Promise((resolve) => {
      if (hasLeaflet()) {
        resolve((window as any).L);
        return;
      }
      loadAssets();
      let attempts = 100; // up to ~10s
      const timer = setInterval(() => {
        if (hasLeaflet() || attempts-- <= 0) {
          clearInterval(timer);
          resolve((window as any).L || null);
        }
      }, 100);
    });
  }

  private debouncedReverse(lat: number, lng: number): void {
    if (this.reverseTimer) {
      clearTimeout(this.reverseTimer);
    }
    this.reverseTimer = setTimeout(() => {
      this.geo
        .reverse(lat, lng)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res?.display_name) {
              this.form.patchValue({ address: res.display_name }, { emitEvent: false });
            }
          },
          error: () => {
            /* ignore */
          }
        });
    }, 400);
  }

  getTypeLabel(type: AdminLocationType | null | undefined): string {
    if (!type) return '';
    const typeMap: Record<AdminLocationType, string> = {
      POOL: 'Bazin',
      TRACK: 'Pista',
      GYM: 'Sala',
      OTHER: 'Alta'
    };
    return typeMap[type] || type;
  }
}
