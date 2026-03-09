import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminLocationService } from '../../services/admin-location.service';
import { AdminLocation, AdminLocationType } from '../../services/models/admin-location.model';
import {
  PremiumConfirmDialogComponent,
  PremiumConfirmDialogData
} from '../../../../shared/components/premium-confirm-dialog/premium-confirm-dialog.component';

@Component({
  selector: 'app-admin-locations',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatDialogModule],
  templateUrl: './admin-locations.component.html',
  styleUrls: ['./admin-locations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLocationsComponent implements OnInit {
  private readonly api = inject(AdminLocationService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly locations = signal<AdminLocation[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly deletingLocationId = signal<string | null>(null);
  readonly filter = signal<'all' | AdminLocationType>('all');

  readonly filteredLocations = computed(() => {
    const currentFilter = this.filter();
    const allLocations = this.locations();
    if (currentFilter === 'all') {
      return allLocations;
    }
    return allLocations.filter(l => l.type === currentFilter);
  });

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.api
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.locations.set(items ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.locations.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
          this.snackbar.open('Nu am putut incarca locatiile', undefined, { duration: 4000 });
        }
      });
  }

  openCreateDialog(): void {
    void this.router.navigate(['/admin/locations/new']);
  }

  openEditDialog(location: AdminLocation): void {
    void this.router.navigate(['/admin/locations', location.id, 'edit']);
  }

  setFilter(filter: 'all' | AdminLocationType): void {
    this.filter.set(filter);
  }

  deleteLocation(location: AdminLocation): void {
    if (this.deletingLocationId() === location.id) {
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
        this.api
          .delete(location.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.deletingLocationId.set(null);
              this.snackbar.open('Locatia a fost stearsa cu succes', undefined, { duration: 3000 });
              this.loadLocations();
            },
            error: (err) => {
              this.deletingLocationId.set(null);
              const message = err?.error?.message || 'Nu am putut sterge locatia';
              this.snackbar.open(message, undefined, { duration: 6000 });
            }
          });
      });
  }

  getTypeLabel(type: AdminLocationType): string {
    const typeMap: Record<AdminLocationType, string> = {
      POOL: 'Bazin',
      TRACK: 'Pista',
      GYM: 'Sala',
      OTHER: 'Alta'
    };
    return typeMap[type] || type;
  }

  getTypeIcon(type: AdminLocationType): string {
    const iconMap: Record<AdminLocationType, string> = {
      POOL: 'pool',
      TRACK: 'directions_run',
      GYM: 'fitness_center',
      OTHER: 'place'
    };
    return iconMap[type] || 'place';
  }

  getPoolCount(): number {
    return this.locations().filter(l => l.type === 'POOL').length;
  }

  getTrackCount(): number {
    return this.locations().filter(l => l.type === 'TRACK').length;
  }

  trackByLocation(index: number, location: AdminLocation): string {
    return location.id;
  }
}
