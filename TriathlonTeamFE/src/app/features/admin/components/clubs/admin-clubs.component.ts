import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AdminClub, UpdateClubPayload } from '../../services/models/admin-club.model';
import { DeleteClubDialogComponent, DeleteClubDialogData, DeleteClubDialogResult } from './delete-club-dialog.component';

@Component({
  selector: 'app-admin-clubs',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatFormFieldModule, MatInputModule],
  templateUrl: './admin-clubs.component.html',
  styleUrls: ['./admin-clubs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminClubsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly clubs = signal<AdminClub[]>([]);
  readonly isLoading = signal(true);
  readonly filter = signal<'all' | 'active' | 'inactive'>('all');
  
  get filteredClubs(): AdminClub[] {
    const all = this.clubs();
    switch (this.filter()) {
      case 'active':
        return all.filter(c => c.active);
      case 'inactive':
        return all.filter(c => !c.active);
      default:
        return all;
    }
  }

  ngOnInit(): void {
    this.loadClubs();
  }

  setFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.filter.set(filter);
  }

  navigateToEdit(club: AdminClub): void {
    this.router.navigate(['/admin/clubs', club.id]);
  }

  toggleClubStatus(club: AdminClub): void {
    const newStatus = !club.active;
    const action = newStatus ? 'activat' : 'dezactivat';
    
    this.adminService
      .setClubStatus(club.id, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open(`Clubul "${club.name}" a fost ${action}`, undefined, { duration: 3000 });
          this.loadClubs();
        },
        error: () => {
          this.snackbar.open(`Nu am putut ${newStatus ? 'activa' : 'dezactiva'} clubul`, undefined, { duration: 4000 });
        }
      });
  }

  deleteClub(club: AdminClub): void {
    const dialogData: DeleteClubDialogData = {
      clubName: club.name,
      coachCount: club.coachCount,
      courseCount: club.courseCount
    };

    const dialogRef = this.dialog.open(DeleteClubDialogComponent, {
      data: dialogData,
      panelClass: 'premium-dialog-panel',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: DeleteClubDialogResult) => {
      if (result?.confirmed) {
        this.performDelete(club);
      }
    });
  }

  private performDelete(club: AdminClub): void {
    this.adminService
      .deleteClub(club.id, true) // force=true to delete with coaches/courses
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Clubul a fost șters cu succes', undefined, { duration: 4000 });
          this.loadClubs();
        },
        error: (err) => {
          const message = err.error?.message || 'Nu am putut șterge clubul';
          this.snackbar.open(message, undefined, { duration: 5000 });
        }
      });
  }

  private loadClubs(): void {
    this.isLoading.set(true);
    this.adminService
      .getAllClubs()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clubs) => {
          this.clubs.set(clubs ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.clubs.set([]);
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut încărca lista de cluburi', undefined, { duration: 4000 });
        }
      });
  }

  getClubLogoUrl(clubId: string): string {
    return this.adminService.getClubLogoUrl(clubId);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getTotalCoaches(): number {
    return this.clubs().reduce((sum, club) => sum + club.coachCount, 0);
  }

  getTotalCourses(): number {
    return this.clubs().reduce((sum, club) => sum + club.courseCount, 0);
  }

  getActiveCount(): number {
    return this.clubs().filter(c => c.active).length;
  }
}
