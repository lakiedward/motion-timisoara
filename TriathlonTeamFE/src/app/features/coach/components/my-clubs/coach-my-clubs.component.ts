import { Component, inject, OnInit, signal, computed, DestroyRef, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PremiumConfirmDialogComponent } from '../../../../shared/components/premium-confirm-dialog/premium-confirm-dialog.component';
import { CoachService } from '../../services/coach.service';
import { CoachClub } from '../../services/coach-api.service';
import { Subject, EMPTY } from 'rxjs';
import { finalize, filter, switchMap, tap, catchError } from 'rxjs/operators';
import { getInitials } from '../../../../shared/utils/string-utils';
import { ErrorReportingService } from '../../../../core/services/error-reporting.service';

@Component({
  selector: 'app-coach-my-clubs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  templateUrl: './coach-my-clubs.component.html',
  styleUrls: ['./coach-my-clubs.component.scss']
})
export class CoachMyClubsComponent implements OnInit {
  private coachService = inject(CoachService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private errorReporting = inject(ErrorReportingService);
  private readonly loadClubsTrigger = new Subject<void>();

  protected readonly getInitials = getInitials;

  clubs = signal<CoachClub[]>([]);
  isLoading = signal<boolean>(true);
  isJoining = signal<boolean>(false);
  isLeaving = signal<Set<string>>(new Set());

  joinForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)]]
  });

  readonly onlinePaymentsCount = computed(() => this.clubs().filter(c => c.canReceivePayments).length);
  readonly stripeConfiguredCount = computed(() => this.clubs().filter(c => c.stripeConfigured).length);

  ngOnInit() {
    // Setup loadClubs stream with switchMap to cancel stale requests
    this.loadClubsTrigger
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.coachService.getMyClubs().pipe(
            tap({
              next: (data) => {
                this.isLoading.set(false);
                this.clubs.set(data ?? []);
              },
              error: (err) => {
                this.isLoading.set(false);
                this.handleError(err, 'loadClubs');
                this.showError('Nu am putut încărca lista de cluburi.');
              }
            }),
            catchError(() => EMPTY)
          )
        )
      )
      .subscribe();

    this.loadClubs();

    // Cache FormControl for join code
    const codeCtrl = this.joinForm.get('code') as FormControl;

    // Auto-normalize input on change
    codeCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        const formatted = this.normalizeJoinCode(value);
        if (formatted !== value) {
          codeCtrl.setValue(formatted, { emitEvent: false });
        }
      });
  }

  // Removed imperative getOnlinePaymentsCount and getStripeConfiguredCount in favor of computed signals

  loadClubs() {
    this.isLoading.set(true);
    this.loadClubsTrigger.next();
  }

  onJoinSubmit() {
    // Guard against duplicate submissions
    if (this.isJoining()) return;
    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }

    // Value is already normalized by valueChanges, but safe to do it here too
    const code = this.normalizeJoinCode(this.joinForm.value.code);
    if (!code) return;

    this.isJoining.set(true);
    this.coachService.joinClub(code)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isJoining.set(false))
      )
      .subscribe({
        next: (response) => {
          this.showSuccess(response.message);
          this.joinForm.reset();
          this.loadClubs();
        },
        error: (err) => {
          this.handleError(err, 'onJoinSubmit');
          const msg = err.error?.message || 'Nu s-a putut efectua înscrierea în club. Verifică codul și încearcă din nou.';
          this.showError(msg);
        }
      });
  }

  private normalizeJoinCode(value: string | null | undefined): string {
    if (!value) return '';
    // Strip non-alphanumeric chars, uppercase, and truncate to max 8 chars
    const raw = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    // Auto-insert hyphen after 4th char
    if (raw.length > 4) {
      return raw.slice(0, 4) + '-' + raw.slice(4);
    }
    return raw;
  }

  leaveClub(club: CoachClub) {
    const dialogRef = this.dialog.open(PremiumConfirmDialogComponent, {
      data: {
        title: 'Părăsire club',
        description: `Ești sigur că vrei să părăsești clubul "${club.name}"?`,
        confirmText: 'Da, părăsește',
        cancelText: 'Anulează',
        variant: 'warning'
      }
    });

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => !!result),
        tap(() => this.isLeaving.update(s => {
          const next = new Set(s);
          next.add(club.id);
          return next;
        })),
        switchMap(() => 
          this.coachService.leaveClub(club.id).pipe(
            finalize(() => this.isLeaving.update(s => {
              const next = new Set(s);
              next.delete(club.id);
              return next;
            }))
          )
        )
      )
      .subscribe({
        next: () => {
          this.showSuccess(`Ai părăsit clubul ${club.name}.`);
          this.loadClubs();
        },
        error: (err) => {
          this.handleError(err, 'leaveClub', { clubId: club.id });
          this.showError('A apărut o eroare la părăsirea clubului.');
        }
      });
  }

  private handleError(error: unknown, methodName: string = 'unknown', extraContext: Record<string, any> = {}): void {
    const err = error instanceof Error ? error : new Error(String(error));
    
    this.errorReporting.captureException(err, {
      component: 'CoachMyClubsComponent',
      method: methodName,
      ...extraContext
    });
    
    if (isDevMode()) {
      console.error(error);
    }
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Închide', {
      duration: 3000,
      panelClass: ['snackbar-success']
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Închide', {
      duration: 5000,
      panelClass: ['snackbar-error']
    });
  }
}
