import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  AfterViewInit,
  PLATFORM_ID,
  signal,
  Inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminLocationService } from '../../../services/admin-location.service';
import {
  AdminLocation,
  AdminLocationPayload,
  AdminLocationType
} from '../../../services/models/admin-location.model';
import { GeocodingService, GeocodeResult } from '../../../services/geocoding.service';

@Component({
  selector: 'app-admin-location-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './admin-location-dialog.component.html',
  styleUrls: ['./admin-location-dialog.component.scss']
})
export class AdminLocationDialogComponent implements OnInit, AfterViewInit {
  private readonly api = inject(AdminLocationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly geo = inject(GeocodingService);
  private readonly dialogRef = inject(MatDialogRef<AdminLocationDialogComponent>);

  readonly isSubmitting = signal(false);
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

  constructor(@Inject(MAT_DIALOG_DATA) public data: AdminLocation | null) {}

  ngOnInit(): void {
    if (this.data) {
      this.form.patchValue({
        name: this.data.name,
        type: this.data.type,
        address: this.data.address || '',
        lat: this.data.lat?.toString() || '',
        lng: this.data.lng?.toString() || ''
      });
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.ensureLeaflet().then(() => {
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
    });
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
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

    this.isSubmitting.set(true);
    const request = this.data
      ? this.api.update(this.data.id, payload)
      : this.api.create(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
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
    const el = document.getElementById('admin-location-dialog-map');
    if (!L || !el) {
      return;
    }
    const defaultCenter = [45.7489, 21.2087]; // Timisoara
    this.isMapReady.set(false);
    this.map = L.map(el).setView(defaultCenter, 12);
    // Limit map to Romania bounds (approx)
    const roBounds = L.latLngBounds([43.6, 20.2], [48.4, 29.9]);
    this.map.setMaxBounds(roBounds);
    (this.map as any).options.maxBoundsViscosity = 0.7;
    const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
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
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        this.updateFormFromCoords(pos.lat, pos.lng);
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
}

