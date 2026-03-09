import { Component, OnInit, ElementRef, ViewChild, PLATFORM_ID, OnDestroy, signal, inject, computed, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PublicActivitySummary, PublicApiService, LocationSummary, ProgramCourse } from '../../../core/services/public-api.service';
import { forkJoin, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

// Leaflet types only - actual import happens dynamically in browser
type LeafletType = typeof import('leaflet');

interface SportSummary {
    id: string;
    name: string;
}

@Component({
    selector: 'app-map-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './map-page.component.html',
    styleUrls: ['./map-page.component.scss']
})
export class MapPageComponent implements OnInit, OnDestroy {
    @ViewChild('mapContainer') mapContainer!: ElementRef;

    private L: LeafletType | undefined; // Leaflet module loaded dynamically
    private map: any;
    private markers: Map<string, any> = new Map();
    private markersGroup: any;
    private readonly platformId = inject(PLATFORM_ID);
    private readonly api = inject(PublicApiService);
    private readonly router = inject(Router);
    private readonly ngZone = inject(NgZone);
    private subscription: Subscription | undefined;

    // Signals
    readonly isLoading = signal(true);
    readonly error = signal<string | null>(null);
    readonly locations = signal<LocationSummary[]>([]);
    readonly courses = signal<ProgramCourse[]>([]);
    readonly activities = signal<PublicActivitySummary[]>([]);
    readonly selectedSport = signal<string | null>(null);
    readonly selectedCity = signal<string>('');
    readonly selectedLocation = signal<string | null>(null);

    // Computed signals
    readonly sports = computed<SportSummary[]>(() => {
        const coursesData = this.courses();
        const activitiesData = this.activities();
        const sportMap = new Map<string, SportSummary>();
        coursesData.forEach(c => {
            if (c.sport && !sportMap.has(c.sport.id)) {
                sportMap.set(c.sport.id, { id: c.sport.id, name: c.sport.name });
            }
        });
        activitiesData.forEach(a => {
            if (a.sport && !sportMap.has(a.sport.id)) {
                sportMap.set(a.sport.id, { id: a.sport.id, name: a.sport.name });
            }
        });
        return Array.from(sportMap.values());
    });

    readonly locationsWithActiveItems = computed<LocationSummary[]>(() => {
        const allLocations = this.locations();
        const selectedSportId = this.selectedSport();
        const coursesData = this.courses();
        const activitiesData = this.activities();

        const locationNameToId = this.buildLocationNameToIdMap(allLocations);

        const locationIdsWithActiveItems = new Set<string>();

        // Courses are already filtered as active by the backend schedule endpoint
        coursesData
            .filter(c => !selectedSportId || c.sport.id === selectedSportId)
            .forEach(c => locationIdsWithActiveItems.add(c.location.id));

        // Activities are active by definition (public activities endpoint)
        activitiesData
            .filter(a => !selectedSportId || a.sport.id === selectedSportId)
            .forEach(a => {
                const resolvedLocationId =
                    a.locationId ||
                    (a.location ? locationNameToId.get(this.normalizeLocationName(a.location)) : undefined);
                if (resolvedLocationId) {
                    locationIdsWithActiveItems.add(resolvedLocationId);
                }
            });

        return allLocations.filter(loc => loc.lat && loc.lng && locationIdsWithActiveItems.has(loc.id));
    });

    readonly availableCities = computed<string[]>(() => {
        const unique = new Map<string, string>(); // normalized -> display value

        for (const loc of this.locationsWithActiveItems()) {
            const city = loc.city?.trim();
            if (!city) continue;

            const key = this.normalizeCity(city);
            if (!key) continue;

            if (!unique.has(key)) {
                unique.set(key, city);
            }
        }

        return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, 'ro'));
    });

    readonly filteredLocations = computed<LocationSummary[]>(() => {
        const base = this.locationsWithActiveItems();
        const selectedCityKey = this.normalizeCity(this.selectedCity());

        if (!selectedCityKey) {
            return base;
        }

        return base.filter(loc => this.normalizeCity(loc.city) === selectedCityKey);
    });

    async ngOnInit(): Promise<void> {
        if (isPlatformBrowser(this.platformId)) {
            // Dynamically import Leaflet only in browser
            // Handle both ESM and CommonJS module formats
            const leafletModule = await import('leaflet');
            this.L = (leafletModule as any).default || leafletModule;
            this.loadData();
        }
    }

    ngOnDestroy(): void {
        if (this.map) {
            this.map.remove();
        }
        this.subscription?.unsubscribe();
    }

    // Public methods for template
    selectSport(sportId: string | null): void {
        this.selectedSport.set(sportId);
        this.updateMapMarkers();
    }

    selectCity(city: string): void {
        this.selectedCity.set(city);
        this.updateMapMarkers();
    }

    resetFilters(): void {
        this.selectedSport.set(null);
        this.selectedCity.set('');
        this.selectedLocation.set(null);
        this.updateMapMarkers();
    }

    selectLocation(location: LocationSummary): void {
        this.selectedLocation.set(location.id);
        if (this.map && location.lat && location.lng) {
            this.map.setView([location.lat, location.lng], 15, { animate: true });
            const marker = this.markers.get(location.id);
            if (marker) {
                marker.openPopup();
            }
        }
    }

    highlightLocation(location: LocationSummary): void {
        const marker = this.markers.get(location.id);
        if (marker) {
            marker.openPopup();
        }
    }

    unhighlightLocation(): void {
        // Close popups when mouse leaves (optional behavior)
    }

    getLocationCourses(locationId: string): ProgramCourse[] {
        const selectedSportId = this.selectedSport();
        return this.courses().filter(c => {
            const matchesLocation = c.location.id === locationId;
            const matchesSport = !selectedSportId || c.sport.id === selectedSportId;
            return matchesLocation && matchesSport;
        });
    }

    getLocationActivities(locationId: string): PublicActivitySummary[] {
        const selectedSportId = this.selectedSport();
        const locationsData = this.locations();
        const locationNameToId = this.buildLocationNameToIdMap(locationsData);

        return this.activities().filter(a => {
            const matchesSport = !selectedSportId || a.sport.id === selectedSportId;
            if (!matchesSport) return false;

            const resolvedLocationId =
                a.locationId ||
                (a.location ? locationNameToId.get(this.normalizeLocationName(a.location)) : undefined);
            return resolvedLocationId === locationId;
        });
    }

    trackByLocationId(index: number, location: LocationSummary): string {
        return location.id;
    }

    retry(): void {
        this.error.set(null);
        this.isLoading.set(true);
        this.loadData();
    }

    zoomIn(): void {
        if (this.map) {
            this.map.zoomIn();
        }
    }

    zoomOut(): void {
        if (this.map) {
            this.map.zoomOut();
        }
    }

    resetView(): void {
        if (this.map && this.markersGroup) {
            this.map.fitBounds(this.markersGroup.getBounds().pad(0.1));
        }
    }

    private loadData(): void {
        const locations$ = this.api.getPublicLocations();
        const courses$ = this.api.getSchedule({ size: 1000 }).pipe(map(res => res.content));
        const activities$ = this.api.getActivities(false);

        this.subscription = forkJoin({
            locations: locations$,
            courses: courses$,
            activities: activities$
        }).subscribe({
            next: ({ locations, courses, activities }) => {
                this.locations.set(locations);
                this.courses.set(courses);
                this.activities.set(activities ?? []);
                this.initMap();
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Failed to load map data', err);
                this.error.set('Nu am putut încărca harta. Te rugăm să încerci din nou mai târziu.');
                this.isLoading.set(false);
            }
        });
    }

    private initMap(): void {
        if (!this.mapContainer) return;

        const validLocations = this.filteredLocations();

        if (validLocations.length === 0) {
            this.error.set('Nu există locații cu cursuri/activități active momentan.');
            return;
        }

        if (!this.L) return;
        const L = this.L;

        // Default center (Timisoara)
        const defaultCenter: [number, number] = [45.7489, 21.2087];

        this.map = L.map(this.mapContainer.nativeElement, {
            center: defaultCenter,
            zoom: 13,
            scrollWheelZoom: true,
            zoomControl: false // We use custom controls
        });

        // Use a nicer tile layer (CartoDB Positron)
        this.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        // Fix for default markers
        const Icon = this.L.Icon as any;
        delete Icon.Default.prototype._getIconUrl;
        this.L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        this.addMarkers();
    }

    private addMarkers(): void {
        if (!this.map || !this.L) return;
        const L = this.L;

        const validLocations = this.filteredLocations();
        const coursesData = this.courses();
        const activitiesData = this.activities();
        const locationNameToId = this.buildLocationNameToIdMap(this.locations());
        const markersArray: any[] = [];

        // Custom icon
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-pin"><span>📍</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        validLocations.forEach(loc => {
            if (!loc.lat || !loc.lng) return;

            const locationCourses = coursesData.filter(c => c.location.id === loc.id);
            const locationActivities = activitiesData.filter(a => {
                const resolvedLocationId =
                    a.locationId ||
                    (a.location ? locationNameToId.get(this.normalizeLocationName(a.location)) : undefined);
                return resolvedLocationId === loc.id;
            });

            const popupContent = `
                <div class="map-popup">
                    <h3 class="map-popup__title">${loc.name}</h3>
                    <p class="map-popup__address">${loc.city || ''} ${loc.address || ''}</p>
                    ${locationCourses.length > 0 ? `
                        <div class="map-popup__courses">
                            <strong>🎯 ${locationCourses.length} cursuri disponibile:</strong>
                            <ul>
                                ${locationCourses.slice(0, 5).map(c => `
                                    <li>
                                        <button type="button" class="map-popup__course-link" data-course-id="${c.id}">
                                            ${c.name} <span class="sport-tag">${c.sport.name}</span>
                                        </button>
                                    </li>
                                `).join('')}
                                ${locationCourses.length > 5 ? `<li class="more">+${locationCourses.length - 5} altele</li>` : ''}
                            </ul>
                            <button type="button" class="map-popup__link" data-location-id="${loc.id}">
                                Vezi toate cursurile de aici →
                            </button>
                        </div>
                    ` : (locationActivities.length > 0 ? `
                        <div class="map-popup__courses">
                            <strong>🎯 ${locationActivities.length} activități disponibile:</strong>
                            <ul>
                                ${locationActivities.slice(0, 5).map(a => `
                                    <li>
                                        <button type="button" class="map-popup__activity-link" data-activity-id="${a.id}">
                                            ${a.name} <span class="sport-tag">${a.sport.name}</span>
                                        </button>
                                    </li>
                                `).join('')}
                                ${locationActivities.length > 5 ? `<li class="more">+${locationActivities.length - 5} altele</li>` : ''}
                            </ul>
                        </div>
                    ` : '<p class="map-popup__empty">📅 Nicio activitate/curs activ momentan</p>')}
                </div>
            `;

            const marker = L.marker([loc.lat, loc.lng], { icon: customIcon })
                .bindPopup(popupContent, { 
                    minWidth: 250, 
                    maxWidth: 320,
                    className: 'custom-popup'
                });

            // Add click handlers for popup links using Angular Router
            marker.on('popupopen', () => {
                const popupEl = marker.getPopup()?.getElement();
                
                // Handle click on "Vezi toate cursurile" button
                const linkBtn = popupEl?.querySelector('.map-popup__link') as HTMLButtonElement;
                if (linkBtn) {
                    linkBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const locationId = linkBtn.getAttribute('data-location-id');
                        if (locationId) {
                            this.ngZone.run(() => {
                                this.router.navigate(['/cursuri'], { 
                                    queryParams: { locationId } 
                                });
                            });
                        }
                    });
                }

                // Handle click on individual course items
                const courseLinks = popupEl?.querySelectorAll('.map-popup__course-link') as NodeListOf<HTMLButtonElement>;
                courseLinks?.forEach(courseBtn => {
                    courseBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const courseId = courseBtn.getAttribute('data-course-id');
                        if (courseId) {
                            this.ngZone.run(() => {
                                this.router.navigate(['/cursuri', courseId]);
                            });
                        }
                    });
                });

                // Handle click on individual activity items
                const activityLinks = popupEl?.querySelectorAll('.map-popup__activity-link') as NodeListOf<HTMLButtonElement>;
                activityLinks?.forEach(activityBtn => {
                    activityBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const activityId = activityBtn.getAttribute('data-activity-id');
                        if (activityId) {
                            this.ngZone.run(() => {
                                this.router.navigate(['/activitati', activityId]);
                            });
                        }
                    });
                });
            });

            marker.addTo(this.map!);
            this.markers.set(loc.id, marker);
            markersArray.push(marker);
        });

        if (markersArray.length > 0) {
            this.markersGroup = L.featureGroup(markersArray);
            this.map.fitBounds(this.markersGroup.getBounds().pad(0.1));
        }
    }

    private updateMapMarkers(): void {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers.clear();
        this.markersGroup = undefined;

        // Re-add markers for filtered locations
        this.addMarkers();
    }

    private normalizeLocationName(name: string): string {
        return (name || '').trim().toLocaleLowerCase();
    }

    private normalizeCity(value: string | null | undefined): string {
        return (value ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    private buildLocationNameToIdMap(locations: LocationSummary[]): Map<string, string> {
        const counts = new Map<string, number>();
        locations.forEach(loc => {
            const key = this.normalizeLocationName(loc.name);
            if (!key) return;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        const map = new Map<string, string>();
        locations.forEach(loc => {
            const key = this.normalizeLocationName(loc.name);
            if (!key) return;
            if ((counts.get(key) ?? 0) === 1) {
                map.set(key, loc.id);
            }
        });
        return map;
    }
}
