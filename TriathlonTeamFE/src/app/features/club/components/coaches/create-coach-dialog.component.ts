import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClubService, CreateClubCoachRequest, ClubCoach } from '../../services/club.service';
import { SportService } from '../../../admin/services/sport.service';

interface Sport {
  id: string;
  name: string;
}

@Component({
  selector: 'app-create-coach-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>
        <mat-icon>person_add</mat-icon>
        Creează Antrenor
      </h2>

      <mat-dialog-content>
        <form [formGroup]="form" class="coach-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nume complet</mat-label>
            <input matInput formControlName="name" placeholder="Ex: Ion Popescu">
            @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
              <mat-error>Numele este obligatoriu</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" placeholder="email@exemplu.com">
            @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
              <mat-error>Email-ul este obligatoriu</mat-error>
            }
            @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
              <mat-error>Email invalid</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Parolă inițială</mat-label>
            <input matInput formControlName="password" [type]="showPassword() ? 'text' : 'password'">
            <button mat-icon-button matSuffix type="button" (click)="togglePassword()">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <mat-error>Parola este obligatorie</mat-error>
            }
            @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
              <mat-error>Parola trebuie să aibă minim 8 caractere</mat-error>
            }
            <mat-hint>Antrenorul poate schimba parola ulterior</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Telefon (opțional)</mat-label>
            <input matInput formControlName="phone" placeholder="07xx xxx xxx">
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Sporturi</mat-label>
            <mat-select formControlName="sportIds" multiple>
              @for (sport of sports(); track sport.id) {
                <mat-option [value]="sport.id">{{ sport.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Bio (opțional)</mat-label>
            <textarea matInput formControlName="bio" rows="3" placeholder="Descriere scurtă a antrenorului..."></textarea>
          </mat-form-field>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close [disabled]="isSubmitting()">Anulează</button>
        <button mat-flat-button color="primary" 
                (click)="onSubmit()" 
                [disabled]="form.invalid || isSubmitting()">
          <mat-icon [class.spinning]="isSubmitting()">{{ isSubmitting() ? 'sync' : 'check' }}</mat-icon>
          <span>{{ isSubmitting() ? 'Se creează...' : 'Creează Antrenor' }}</span>
        </button>
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
      border-bottom: 1px solid rgba(37, 99, 235, 0.1);
      color: var(--sport-primary, #2563eb);
    }

    mat-dialog-content {
      padding: 1.5rem !important;
      max-height: 60vh;
    }

    .coach-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-actions {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color, #e5e7eb);
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
export class CreateCoachDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clubService = inject(ClubService);
  private readonly sportService = inject(SportService);
  private readonly dialogRef = inject(MatDialogRef<CreateCoachDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);

  readonly sports = signal<Sport[]>([]);
  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: [''],
    bio: [''],
    sportIds: [[]]
  });

  ngOnInit(): void {
    this.loadSports();
  }

  private loadSports(): void {
    this.sportService.getSports().subscribe({
      next: (sports: Sport[]) => this.sports.set(sports),
      error: () => console.error('Failed to load sports')
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    const request: CreateClubCoachRequest = {
      name: this.form.value.name,
      email: this.form.value.email,
      password: this.form.value.password,
      phone: this.form.value.phone || undefined,
      bio: this.form.value.bio || undefined,
      sportIds: this.form.value.sportIds?.length ? this.form.value.sportIds : undefined
    };

    this.clubService.createCoach(request).subscribe({
      next: (coach) => {
        this.snackBar.open(`Antrenorul ${coach.name} a fost creat cu succes!`, 'OK', { duration: 3000 });
        this.dialogRef.close(coach);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSubmitting.set(false);
        const message = err.error?.message || 'Eroare la crearea antrenorului';
        this.snackBar.open(message, 'OK', { duration: 5000 });
      }
    });
  }
}
