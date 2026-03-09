import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService } from '../../services/admin.service';
import { AdminActivity } from '../../services/models/admin-activity.model';

@Component({
  selector: 'app-admin-activities',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './admin-activities.component.html',
  styleUrls: ['./admin-activities.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminActivitiesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly activities = signal<AdminActivity[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly updatingActivityId = signal<string | null>(null);

  // Computed stats
  getActiveCount(): number {
    return this.activities().filter(a => a.active).length;
  }

  getTotalEnrollments(): number {
    return this.activities().reduce((sum, a) => sum + (a.enrolledCount || 0), 0);
  }

  ngOnInit(): void {
    this.loadActivities();
  }

  goToCreate(): void {
    void this.router.navigate(['/admin/activities', 'new']);
  }

  editActivity(activity: AdminActivity): void {
    void this.router.navigate(['/admin/activities', activity.id, 'edit']);
  }

  toggleStatus(activity: AdminActivity): void {
    if (this.updatingActivityId()) {
      return;
    }
    const nextActive = !activity.active;
    this.updatingActivityId.set(activity.id);
    this.adminService
      .setActivityStatus(activity.id, nextActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activities.update((list) =>
            list.map((item) => (item.id === activity.id ? { ...item, active: nextActive } : item))
          );
          this.updatingActivityId.set(null);
          this.snackbar.open(
            nextActive ? 'Activitatea a fost activată' : 'Activitatea a fost dezactivată',
            undefined,
            { duration: 3000 }
          );
        },
        error: () => {
          this.updatingActivityId.set(null);
          this.snackbar.open('Nu am putut actualiza statusul activității', undefined, { duration: 4000 });
        }
      });
  }

  deleteActivity(activity: AdminActivity): void {
    if (this.updatingActivityId()) {
      return;
    }

    const confirmed = confirm(
      `Sigur vrei să ștergi activitatea "${activity.name}"? Această acțiune este permanentă.`
    );

    if (!confirmed) {
      return;
    }

    this.updatingActivityId.set(activity.id);
    this.adminService
      .deleteActivity(activity.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activities.update((list) => list.filter((item) => item.id !== activity.id));
          this.updatingActivityId.set(null);
          this.snackbar.open('Activitatea a fost ștearsă', undefined, { duration: 3000 });
        },
        error: (err) => {
          this.updatingActivityId.set(null);
          const message = err?.error?.message || 'Nu am putut șterge activitatea';
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  trackByActivity(_: number, activity: AdminActivity): string {
    return activity.id;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  loadActivities(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.adminService
      .getAllActivities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activities) => {
          this.activities.set(activities ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.activities.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
          this.snackbar.open('Nu am putut încărca lista de activități', undefined, { duration: 4000 });
        }
      });
  }
}
