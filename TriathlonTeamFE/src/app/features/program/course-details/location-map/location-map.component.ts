import { Component, Input, computed, inject, PLATFORM_ID, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

// Leaflet types only - actual import happens dynamically in browser
type LeafletType = typeof import('leaflet');

@Component({
  selector: 'app-location-map',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './location-map.component.html',
  styleUrls: ['./location-map.component.scss']
})
export class LocationMapComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) location!: Location;
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  
  private readonly platformId = inject(PLATFORM_ID);
  private L: LeafletType | undefined;
  private map: any;
  private isInitializing = false;

  readonly hasCoordinates = computed(() => {
    return this.location.lat !== undefined && this.location.lng !== undefined;
  });

  // NOTE: We initialize Leaflet after the view exists, because ViewChild is only available then.
  // Also, Angular does NOT await async lifecycle hooks, so we must ensure Leaflet is loaded
  // before calling initMap().
  ngAfterViewInit(): void {
    void this.ensureMapInitialized();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private async ensureMapInitialized(): Promise<void> {
    if (this.map || this.isInitializing) return;
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.hasCoordinates()) return;
    if (!this.mapContainer) return;

    this.isInitializing = true;
    try {
      if (!this.L) {
        // Dynamically import Leaflet only in browser
        const leafletModule = await import('leaflet');
        this.L = (leafletModule as any).default || leafletModule;
      }

      this.initMap();

      // Leaflet sometimes needs a tick to correctly measure container size.
      // Calling invalidateSize() fixes "blank map" issues when the container
      // is rendered/laid out right around init time.
      setTimeout(() => {
        try {
          this.map?.invalidateSize?.();
        } catch {
          // ignore
        }
      }, 0);
    } finally {
      this.isInitializing = false;
    }
  }

  private initMap(): void {
    if (!this.mapContainer || !this.L || !this.location.lat || !this.location.lng) return;
    const L = this.L;

    const coords: [number, number] = [this.location.lat, this.location.lng];

    this.map = L.map(this.mapContainer.nativeElement, {
      center: coords,
      zoom: 15,
      scrollWheelZoom: false, // Better UX for maps inside scrollable content
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Fix for default markers if we ever need them
    const Icon = L.Icon as any;
    delete Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    // Add custom marker
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin"><span>📍</span></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    L.marker(coords, { icon: customIcon })
      .bindPopup(`
        <div class="map-popup">
          <h3 class="map-popup__title">${this.location.name}</h3>
          <p class="map-popup__address">${this.location.city || ''} ${this.location.address || ''}</p>
          <button type="button" class="map-popup__link" id="open-google-maps">
            Deschide în Google Maps →
          </button>
        </div>
      `, {
        minWidth: 200,
        className: 'custom-popup'
      })
      .addTo(this.map)
      .on('popupopen', () => {
        const btn = document.getElementById('open-google-maps');
        if (btn) {
          btn.onclick = () => this.openInGoogleMaps();
        }
      });
  }

  readonly mapClickUrl = computed(() => {
    if (!this.hasCoordinates()) return '';
    
    const lat = this.location.lat!;
    const lng = this.location.lng!;
    
    return `https://www.google.com/maps?q=${lat},${lng}`;
  });

  readonly searchUrl = computed(() => {
    const query = encodeURIComponent(
      [this.location.name, this.location.address, this.location.city]
        .filter(Boolean)
        .join(', ')
    );
    
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  });

  openInGoogleMaps(): void {
    const url = this.hasCoordinates() ? this.mapClickUrl() : this.searchUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  getLocationDisplayText(): string {
    const parts = [
      this.location.name,
      this.location.address,
      this.location.city
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  getMapFallbackText(): string {
    if (this.hasCoordinates()) {
      return 'Harta nu poate fi încărcată';
    }
    
    return 'Coordonatele nu sunt disponibile';
  }
}
