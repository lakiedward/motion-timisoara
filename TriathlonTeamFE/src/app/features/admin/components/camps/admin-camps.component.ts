import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminService } from '../../services/admin.service';
import { AdminCamp } from '../../services/models/admin-camp.model';

@Component({
  selector: 'app-admin-camps',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './admin-camps.component.html',
  styleUrls: ['./admin-camps.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCampsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly camps = signal<AdminCamp[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.loadCamps();
  }

  trackByCamp(_: number, camp: AdminCamp): string {
    return camp.id;
  }

  goToCreate(): void {
    void this.router.navigate(['/admin', 'camps', 'new']);
  }

  editCamp(camp: AdminCamp): void {
    void this.router.navigate(['/admin', 'camps', camp.id, 'edit']);
  }

  archiveCamp(_: AdminCamp): void {
    this.snackbar.open('Functionalitatea de arhivare va fi disponibila in curand.', undefined, {
      duration: 3500
    });
  }

  enrollmentSummary(camp: AdminCamp): string {
    const enrolled = camp.enrolledCount ?? 0;
    const capacity = camp.capacity ?? 0;
    if (enrolled === 0 && capacity === 0) {
      return 'N/A';
    }
    if (capacity > 0) {
      return `${enrolled}/${capacity}`;
    }
    return `${enrolled}`;
  }

  statusLabel(camp: AdminCamp): string {
    if (!camp.periodEnd) {
      return 'Necunoscut';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(camp.periodEnd);
    end.setHours(0, 0, 0, 0);
    return end.getTime() >= today.getTime() ? 'Activ' : 'Inactiv';
  }

  getActiveCount(): number {
    return this.camps().filter(c => this.statusLabel(c) === 'Activ').length;
  }

  getTotalEnrollments(): number {
    return this.camps().reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
  }

  loadCamps(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.adminService
      .getAllCamps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (camps) => {
          this.camps.set((camps ?? []).sort((a, b) => this.sortByStartDate(a, b)));
          this.isLoading.set(false);
        },
        error: () => {
          this.camps.set([]);
          this.hasError.set(true);
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut incarca taberele.', undefined, { duration: 4000 });
        }
      });
  }

  private sortByStartDate(a: AdminCamp, b: AdminCamp): number {
    const startA = a.periodStart ? new Date(a.periodStart).getTime() : 0;
    const startB = b.periodStart ? new Date(b.periodStart).getTime() : 0;
    return startA - startB;
  }
}

