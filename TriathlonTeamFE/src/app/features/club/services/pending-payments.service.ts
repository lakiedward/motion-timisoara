import { Injectable, signal, inject, DestroyRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

export interface PaymentRowWithId {
  id: string;
}

@Injectable()
export abstract class PendingPaymentsService<T extends PaymentRowWithId> {
  protected readonly snackbar = inject(MatSnackBar);
  protected readonly destroyRef = inject(DestroyRef);

  readonly pendingPayments = signal<T[]>([]);
  readonly isLoadingPayments = signal(false);
  readonly isPaymentsError = signal(false);
  readonly confirmingPaymentIds = signal<Set<string>>(new Set());

  isConfirming(id: string): boolean {
    return this.confirmingPaymentIds().has(id);
  }

  protected abstract loadPendingPaymentsApi(): Observable<T[]>;
  protected abstract confirmPaymentApi(id: string): Observable<void>;

  loadPendingPayments(): void {
    this.isLoadingPayments.set(true);
    this.isPaymentsError.set(false);
    this.loadPendingPaymentsApi()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.pendingPayments.set(rows ?? []);
          this.isLoadingPayments.set(false);
        },
        error: (err) => {
          console.error('Error loading pending payments:', err);
          this.snackbar.open('Nu am putut încărca plățile în așteptare', 'Închide', { duration: 5000 });
          this.pendingPayments.set([]);
          this.isLoadingPayments.set(false);
          this.isPaymentsError.set(true);
        }
      });
  }

  confirmPayment(id: string, onSuccess?: () => void): void {
    this.addConfirmingPayment(id);

    this.confirmPaymentApi(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Plata a fost confirmată', undefined, { duration: 3000 });
          this.removeConfirmingPayment(id);
          this.loadPendingPayments();
          if (onSuccess) {
            onSuccess();
          }
        },
        error: () => {
          this.snackbar.open('Nu am putut confirma plata', undefined, { duration: 3000 });
          this.removeConfirmingPayment(id);
        }
      });
  }

  private addConfirmingPayment(id: string): void {
    this.confirmingPaymentIds.update(ids => {
      const next = new Set(ids);
      next.add(id);
      return next;
    });
  }

  private removeConfirmingPayment(id: string): void {
    this.confirmingPaymentIds.update(ids => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}
