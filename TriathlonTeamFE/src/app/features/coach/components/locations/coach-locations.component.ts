import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/auth';
import { LocationService as CoreLocationService, LocationDto } from '../../../../core/services/location.service';
import {
  PremiumConfirmDialogComponent,
  PremiumConfirmDialogData
} from '../../../../shared/components/premium-confirm-dialog/premium-confirm-dialog.component';

@Component({
  selector: 'app-coach-locations',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule, MatDialogModule],
  templateUrl: './coach-locations.component.html',
  styleUrls: ['./coach-locations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachLocationsComponent implements OnInit {
  private readonly locationService = inject(CoreLocationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly cities = signal<string[]>([]);
  readonly recentLocations = signal<LocationDto[]>([]);
  readonly isLoading = signal(true);

  readonly selectedCity = signal<string>('');
  readonly searchQuery = signal<string>('');

  readonly locations = signal<LocationDto[]>([]);
  readonly isLocationsLoading = signal(false);
  readonly hasLocationsError = signal(false);
  readonly deletingLocationId = signal<string | null>(null);
  readonly updatingLocationId = signal<string | null>(null);

  readonly currentUserId = signal<string | null>(null);
  readonly currentUserRole = signal<Role | null>(null);

  ngOnInit(): void {
    this.auth.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUserId.set(user?.id ?? null);
        this.currentUserRole.set(user?.role ?? null);
      });
    this.loadPageData();
  }

  openCreateLocation(): void {
    void this.router.navigate(['/coach/locations/new']);
  }

  onCityChange(city: string): void {
    this.selectedCity.set(city);
    this.loadLocations();
  }

  onSearchInput(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  searchLocations(): void {
    this.loadLocations();
  }

  openEditLocation(location: LocationDto): void {
    if (!location) {
      return;
    }
    void this.router.navigate(['/coach/locations', location.id, 'edit']);
  }

  toggleLocationStatus(location: LocationDto): void {
    if (this.updatingLocationId()) return;

    const current = location.isActive ?? true;
    const nextActive = !current;
    this.updatingLocationId.set(location.id);

    this.locationService.updateLocation(location.id, { isActive: nextActive })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.updatingLocationId.set(null);
          // Use server response as source of truth when present; fall back to the intended toggle value
          // for older backends that might not return `isActive`.
          const serverIsActive = (updated as any)?.isActive ?? (updated as any)?.active;
          const mergedIsActive = typeof serverIsActive === 'boolean' ? serverIsActive : nextActive;
          const merged: LocationDto = { ...location, ...updated, isActive: mergedIsActive };
          this.locations.update((items) => items.map(l => l.id === location.id ? merged : l));

          this.snackbar.open(
            mergedIsActive ? 'Locație activată' : 'Locație dezactivată',
            undefined, 
            { duration: 2500 }
          );
        },
        error: (err) => {
          console.error('Error toggling location:', err);
          this.updatingLocationId.set(null);
          this.snackbar.open('Eroare la actualizarea locației', undefined, { duration: 3000 });
        }
      });
  }

  deleteLocation(location: LocationDto): void {
    if (this.deletingLocationId() === location.id || this.updatingLocationId() === location.id) {
      return;
    }

    const dialogData: PremiumConfirmDialogData = {
      title: 'Ștergi locația?',
      subtitle: location.name,
      description: `Confirmă ștergerea locației "${location.name}".`,
      note: 'Această acțiune nu poate fi anulată.',
      confirmText: 'Șterge',
      cancelText: 'Renunță',
      icon: 'delete',
      variant: 'danger'
    };

    const dialogRef = this.dialog.open(PremiumConfirmDialogComponent, {
      data: dialogData,
      panelClass: 'premium-dialog-panel',
      disableClose: true
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) {
          return;
        }

        this.deletingLocationId.set(location.id);
        this.locationService
          .deleteLocation(location.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.deletingLocationId.set(null);
              this.locations.update((items) => items.filter((i) => i.id !== location.id));
              this.snackbar.open('Locația a fost ștearsă', undefined, { duration: 3500 });
              this.loadPageData();
            },
            error: (err) => {
              this.deletingLocationId.set(null);
              const message = err?.error?.message || 'Nu am putut șterge locația';
              this.snackbar.open(message, undefined, { duration: 6000 });
            }
          });
      });
  }

  canManage(location: LocationDto): boolean {
    const role = this.currentUserRole();
    const userId = this.currentUserId();

    if (!role) {
      return false;
    }
    if (role === 'ADMIN') {
      return true;
    }
    if (role !== 'COACH') {
      return false;
    }
    return !location.clubId && !!userId && location.createdByUserId === userId;
  }

  getTypeLabel(type: string): string {
    return this.locationService.getTypeLabel(type);
  }

  getTypeIcon(type: string): string {
    return this.locationService.getTypeIcon(type);
  }

  trackByLocation(index: number, location: LocationDto): string {
    return location.id;
  }

  private loadPageData(): void {
    this.isLoading.set(true);

    forkJoin({
      cities: this.locationService.getCities().pipe(catchError(() => of([]))),
      recent: this.locationService.getRecentLocations(undefined, 5).pipe(catchError(() => of([])))
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ cities, recent }) => {
        this.cities.set(cities);
        this.recentLocations.set(recent);
        this.isLoading.set(false);
        this.loadLocations();
      });
  }

  private loadLocations(): void {
    this.isLocationsLoading.set(true);
    this.hasLocationsError.set(false);

    const city = this.selectedCity().trim() || undefined;
    const query = this.searchQuery().trim() || undefined;

    this.locationService
      .searchLocations(city, query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.locations.set(items ?? []);
          this.isLocationsLoading.set(false);
        },
        error: () => {
          this.locations.set([]);
          this.isLocationsLoading.set(false);
          this.hasLocationsError.set(true);
        }
      });
  }
}
