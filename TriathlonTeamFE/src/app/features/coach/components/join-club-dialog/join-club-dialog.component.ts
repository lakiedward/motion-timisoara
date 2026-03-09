import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CoachApiService, JoinClubResponse } from '../../services/coach-api.service';

@Component({
  selector: 'app-join-club-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>
        <mat-icon>group_add</mat-icon>
        Alătură-te unui Club
      </h2>

      <mat-dialog-content>
        <p class="dialog-description">
          Introdu codul de invitație primit de la club pentru a te alătura echipei lor.
        </p>

        <form [formGroup]="form" class="join-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Cod de Invitație</mat-label>
            <input matInput 
                   formControlName="code" 
                   placeholder="XXXX-XXXX"
                   style="text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
            @if (form.get('code')?.hasError('required') && form.get('code')?.touched) {
              <mat-error>Codul de invitație este obligatoriu</mat-error>
            }
            <mat-hint>Format: XXXX-XXXX</mat-hint>
          </mat-form-field>
        </form>

        @if (successMessage()) {
          <div class="success-message">
            <mat-icon>check_circle</mat-icon>
            <span>{{ successMessage() }}</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close [disabled]="isSubmitting()">
          {{ successMessage() ? 'Închide' : 'Anulează' }}
        </button>
        @if (!successMessage()) {
          <button mat-flat-button color="primary" 
                  (click)="onSubmit()" 
                  [disabled]="form.invalid || isSubmitting()">
            <mat-icon [class.spinning]="isSubmitting()">{{ isSubmitting() ? 'sync' : 'login' }}</mat-icon>
            <span>{{ isSubmitting() ? 'Se procesează...' : 'Alătură-te' }}</span>
          </button>
        }
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      min-width: 400px;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(16, 185, 129, 0.3);
    }

    mat-dialog-content {
      padding: 1.5rem !important;
    }

    .dialog-description {
      color: var(--sport-text-muted, #64748b);
      margin: 0 0 1.5rem;
      font-size: 0.95rem;
    }

    .join-form {
      display: flex;
      flex-direction: column;
    }

    .full-width {
      width: 100%;
    }

    .success-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: #ecfdf5;
      border: 1px solid #10b981;
      border-radius: 8px;
      color: #047857;
      margin-top: 1rem;

      mat-icon {
        color: #10b981;
      }
    }

    mat-dialog-actions {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(16, 185, 129, 0.3);
      gap: 0.5rem;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class JoinClubDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly coachApiService = inject(CoachApiService);
  private readonly dialogRef = inject(MatDialogRef<JoinClubDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);

  readonly isSubmitting = signal(false);
  readonly successMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    code: ['', [Validators.required]]
  });

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    const code = this.form.value.code.trim().toUpperCase();

    this.coachApiService.joinClub(code).subscribe({
      next: (response: JoinClubResponse) => {
        this.isSubmitting.set(false);
        this.successMessage.set(response.message);
        this.snackBar.open(response.message, 'OK', { duration: 3000 });
        
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          this.dialogRef.close(response);
        }, 1500);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSubmitting.set(false);
        const message = err.error?.message || 'Eroare la procesarea codului';
        this.snackBar.open(message, 'OK', { duration: 5000 });
      }
    });
  }
}
