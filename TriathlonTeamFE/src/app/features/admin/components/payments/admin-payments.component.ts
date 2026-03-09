import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminApiService,
  AdminCoach,
  AdminPaymentFilters,
  AdminPaymentRow,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly filterForm = this.fb.group({
    kind: [''],
    status: [''],
    method: [''],
    coachId: [''],
    from: [''],
    to: [''],
  });

  readonly payments = signal<AdminPaymentRow[]>([]);
  readonly coaches = signal<AdminCoach[]>([]);
  readonly isLoading = signal(true);
  readonly displayedColumns = [
    'child',
    'parent',
    'product',
    'coach',
    'method',
    'status',
    'amount',
    'updated',
    'actions',
  ];

  constructor() {
    this.loadCoaches();
    this.loadPayments();
    this.filterForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadPayments());
  }

  getPendingCount(): number {
    return this.payments().filter(p => p.status === 'PENDING').length;
  }

  getSucceededCount(): number {
    return this.payments().filter(p => p.status === 'SUCCEEDED').length;
  }

  markCash(row: AdminPaymentRow): void {
    this.api.markCashPaid(row.id).subscribe({
      next: () => {
        this.snackbar.open('Plata marcata ca finalizata', undefined, { duration: 4000 });
        this.loadPayments();
      },
      error: () => {
        this.snackbar.open('Nu am putut marca plata', undefined, { duration: 4000 });
      },
    });
  }

  exportCsv(): void {
    const filters = this.buildFilters();
    this.api.exportPaymentsCsv(filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'payments.csv';
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackbar.open('Nu am putut exporta rapoartele', undefined, { duration: 4000 });
      },
    });
  }

  private loadCoaches(): void {
    this.api
      .getCoaches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((coaches) => this.coaches.set(coaches));
  }

  private loadPayments(): void {
    this.isLoading.set(true);
    const filters = this.buildFilters();
    this.api
      .getPayments(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.payments.set(rows);
          this.isLoading.set(false);
        },
        error: () => {
          this.payments.set([]);
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut incarca platile', undefined, { duration: 4000 });
        },
      });
  }

  private buildFilters(): AdminPaymentFilters {
    const raw = this.filterForm.value;
    return {
      kind: raw.kind || undefined,
      status: raw.status || undefined,
      method: raw.method || undefined,
      coachId: raw.coachId || undefined,
      from: raw.from || undefined,
      to: raw.to || undefined,
    };
  }
}
