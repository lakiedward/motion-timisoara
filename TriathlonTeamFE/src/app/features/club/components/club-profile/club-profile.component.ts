import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PremiumConfirmDialogComponent } from '../../../../shared/components/premium-confirm-dialog/premium-confirm-dialog.component';
import { EMPTY, catchError } from 'rxjs';
import { finalize, filter, switchMap, tap } from 'rxjs/operators';
import { ClubService, ClubProfile, UpdateClubProfileRequest } from '../../services/club.service';

@Component({
  selector: 'app-club-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  templateUrl: './club-profile.component.html',
  styleUrls: ['./club-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubProfileComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<ClubProfile | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    // Public
    name: ['', Validators.required],
    description: [''],
    website: [''],

    // Contact
    email: ['', Validators.email],
    publicEmailConsent: [false],
    phone: [''],
    address: [''],
    city: [''],

    // Billing / Company
    companyName: [''],
    companyCui: [''],
    companyRegNumber: [''],
    companyAddress: [''],
    bankAccount: [''],
    bankName: ['']
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.isLoading.set(true);
    this.clubService
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.form.reset({
            name: profile.name ?? '',
            description: profile.description ?? '',
            website: profile.website ?? '',
            email: profile.email ?? '',
            publicEmailConsent: profile.publicEmailConsent ?? false,
            phone: profile.phone ?? '',
            address: profile.address ?? '',
            city: profile.city ?? '',
            companyName: profile.companyName ?? '',
            companyCui: profile.companyCui ?? '',
            companyRegNumber: profile.companyRegNumber ?? '',
            companyAddress: profile.companyAddress ?? '',
            bankAccount: profile.bankAccount ?? '',
            bankName: profile.bankName ?? ''
          });
          this.form.markAsPristine();
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.snackBar.open('Eroare la încărcarea profilului clubului', 'Închide', { duration: 3000 });
        }
      });
  }

  save(): void {
    if (this.form.invalid || this.isSaving()) return;

    const formValue = this.form.value;
    const name = (formValue.name || '').trim();
    if (!name) return;

    const payload: UpdateClubProfileRequest = {
      name,
      description: formValue.description?.trim() || undefined,
      website: formValue.website?.trim() || undefined,
      email: formValue.email?.trim() || undefined,
      publicEmailConsent: formValue.publicEmailConsent ?? false,
      phone: formValue.phone?.trim() || undefined,
      address: formValue.address?.trim() || undefined,
      city: formValue.city?.trim() || undefined,
      companyName: formValue.companyName?.trim() || undefined,
      companyCui: formValue.companyCui?.trim() || undefined,
      companyRegNumber: formValue.companyRegNumber?.trim() || undefined,
      companyAddress: formValue.companyAddress?.trim() || undefined,
      bankAccount: formValue.bankAccount?.trim() || undefined,
      bankName: formValue.bankName?.trim() || undefined
    };

    this.isSaving.set(true);
    this.clubService
      .updateProfile(payload)
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.snackBar.open('Profil salvat cu succes', 'OK', { duration: 2500 });
          this.form.markAsPristine();
        },
        error: () => {
          this.snackBar.open('Eroare la salvare', 'Închide', { duration: 3000 });
        }
      });
  }

  withdrawConsent(): void {
    if (this.isSaving()) return;
    
    // Return early if consent is already withdrawn/false
    if (!this.form.get('publicEmailConsent')?.value) return;

    const dialogRef = this.dialog.open(PremiumConfirmDialogComponent, {
      data: {
        title: 'Retragere consimțământ',
        description: 'Sunteți sigur că doriți să retrageți consimțământul pentru afișarea publică a email-ului?',
        confirmText: 'Da, retrage',
        cancelText: 'Anulează',
        variant: 'warning'
      }
    });

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => !!result),
        switchMap(() => {
          this.isSaving.set(true);
          return this.clubService.withdrawEmailConsent().pipe(
            finalize(() => this.isSaving.set(false)),
            tap((res) => {
              this.snackBar.open(res.message, 'OK', { duration: 3000 });
              this.loadProfile();
            }),
            catchError(() => {
              this.snackBar.open('Eroare la retragerea consimțământului', 'Închide', { duration: 3000 });
              return EMPTY;
            })
          );
        })
      )
      .subscribe();
  }

  onCancel(): void {
    void this.router.navigate(['/club']);
  }
}


