import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
// MatMenu removed as we're switching to inline buttons
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ClubService, ClubLocation } from '../../services/club.service';
import {
  PremiumConfirmDialogComponent,
  PremiumConfirmDialogData
} from '../../../../shared/components/premium-confirm-dialog/premium-confirm-dialog.component';

@Component({
  selector: 'app-club-locations',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './club-locations.component.html',
  styleUrls: ['./club-locations.component.scss']
})
export class ClubLocationsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly clubService = inject(ClubService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  // State
  readonly locations = signal<ClubLocation[]>([]);
  readonly isLoading = signal(true);
  readonly updatingLocationId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadLocations();
  }

  private loadLocations(): void {
    this.isLoading.set(true);
    this.clubService.getLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading locations', err);
        this.isLoading.set(false);
        this.showNotification('Eroare la încărcarea datelor', 'error');
      }
    });
  }

  addLocation(): void {
    void this.router.navigate(['/club/locations/new']);
  }

  editLocation(location: ClubLocation): void {
    void this.router.navigate(['/club/locations', location.id, 'edit']);
  }

  toggleLocationStatus(location: ClubLocation): void {
    if (this.updatingLocationId()) return;
    
    this.updatingLocationId.set(location.id);
    const newStatus = !location.isActive;

    this.clubService.updateLocation(location.id, { isActive: newStatus }).subscribe({
      next: (updated) => {
        this.locations.update(list => 
          list.map(l => l.id === updated.id ? updated : l)
        );
        this.updatingLocationId.set(null);
        this.showNotification(
          `Locația a fost ${updated.isActive ? 'activată' : 'dezactivată'}`, 
          'success'
        );
      },
      error: (err) => {
        console.error('Error updating status', err);
        this.updatingLocationId.set(null);
        this.showNotification('Eroare la actualizarea statusului', 'error');
      }
    });
  }

  deleteLocation(location: ClubLocation): void {
    if (this.updatingLocationId()) return;

    const dialogData: PremiumConfirmDialogData = {
      title: 'Ștergi locația?',
      subtitle: location.name,
      description: 'Confirmă ștergerea locației. Această acțiune nu poate fi anulată.',
      note: 'Dacă există cursuri active aici, acestea vor trebui reconfigurate.',
      confirmText: 'Șterge',
      cancelText: 'Renunță',
      variant: 'danger',
      icon: 'delete'
    };

    const dialogRef = this.dialog.open(PremiumConfirmDialogComponent, {
      data: dialogData,
      panelClass: 'premium-dialog-panel',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.performDelete(location.id);
      }
    });
  }

  private performDelete(id: string): void {
    this.updatingLocationId.set(id);
    this.clubService.deleteLocation(id).subscribe({
      next: () => {
        this.locations.update(list => list.filter(l => l.id !== id));
        this.updatingLocationId.set(null);
        this.showNotification('Locația a fost ștearsă', 'success');
      },
      error: (err) => {
        console.error('Error deleting location', err);
        this.updatingLocationId.set(null);
        this.showNotification('Nu s-a putut șterge locația', 'error');
      }
    });
  }

  // Stats helpers
  getActiveLocationsCount(): number {
    return this.locations().filter(l => l.isActive).length;
  }

  getTotalCapacity(): number {
    return this.locations().reduce((sum, loc) => sum + (loc.capacity || 0), 0);
  }

  trackByLocation(_: number, location: ClubLocation): string {
    return location.id;
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: type === 'error' ? 'snackbar-error' : 'snackbar-success'
    });
  }
}
