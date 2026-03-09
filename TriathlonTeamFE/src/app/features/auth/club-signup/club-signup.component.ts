import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  DestroyRef,
  OnInit,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorSnackbarService } from '../../../shared/services/error-snackbar.service';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { ClubRegistrationResponse } from '../../../core/models/auth';
import { SportService } from '../../admin/services/sport.service';
import { Sport } from '../../admin/services/models/sport.model';
import { ClubService } from '../../club/services/club.service';
import { readFileAsDataUrl, validateImageFile } from '../../../shared/utils/image-upload';

@Component({
  selector: 'app-club-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatStepperModule,
    FormErrorComponent
  ],
  templateUrl: './club-signup.component.html',
  styleUrls: ['./club-signup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubSignupComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sportService = inject(SportService);
  private readonly clubService = inject(ClubService);

  // Step 1: Owner Info
  readonly ownerForm = this.fb.nonNullable.group({
    ownerName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]]
  });

  // Step 2: Club Info
  readonly clubForm = this.fb.nonNullable.group({
    clubName: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    clubEmail: ['', [Validators.email]],
    clubPhone: [''],
    address: [''],
    city: ['']
  });

  // Sports
  readonly availableSports = signal<Sport[]>([]);
  readonly selectedSportIds = signal<Set<string>>(new Set());
  readonly sportsLoading = signal(false);

  readonly isSubmitting = signal(false);
  readonly currentStep = signal(0);
  readonly showPassword = signal(false);
  readonly registrationComplete = signal(false);
  readonly stripeOnboardingUrl = signal<string | null>(null);

  // Branding (logo + hero photo) after signup
  readonly logoPreview = signal<string | null>(null);
  readonly heroPhotoPreview = signal<string | null>(null);
  readonly logoUploading = signal(false);
  readonly heroUploading = signal(false);

  ngOnInit(): void {
    this.loadSports();
  }

  private loadSports(): void {
    this.sportsLoading.set(true);
    this.sportService.getSports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => {
          this.availableSports.set(sports);
          this.sportsLoading.set(false);
        },
        error: () => {
          this.sportsLoading.set(false);
        }
      });
  }

  toggleSport(sportId: string): void {
    const current = this.selectedSportIds();
    const updated = new Set(current);
    if (updated.has(sportId)) {
      updated.delete(sportId);
    } else {
      updated.add(sportId);
    }
    this.selectedSportIds.set(updated);
  }

  isSportSelected(sportId: string): boolean {
    return this.selectedSportIds().has(sportId);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  nextStep(): void {
    const step = this.currentStep();
    
    // Step 0: Validate owner info
    if (step === 0 && this.ownerForm.invalid) {
      this.ownerForm.markAllAsTouched();
      return;
    }
    
    // Step 1: Validate club info
    if (step === 1 && this.clubForm.invalid) {
      this.clubForm.markAllAsTouched();
      return;
    }
    
    this.currentStep.update(s => Math.min(s + 1, 2));
  }

  prevStep(): void {
    this.currentStep.update(s => Math.max(s - 1, 0));
  }

  submit(): void {
    if (this.isSubmitting()) return;

    // Validate all forms
    if (this.ownerForm.invalid || this.clubForm.invalid) {
      this.ownerForm.markAllAsTouched();
      this.clubForm.markAllAsTouched();
      return;
    }

    const ownerInfo = this.ownerForm.getRawValue();
    const clubInfo = this.clubForm.getRawValue();

    const request = {
      ownerName: ownerInfo.ownerName,
      email: ownerInfo.email,
      password: ownerInfo.password,
      phone: ownerInfo.phone,
      clubName: clubInfo.clubName,
      description: clubInfo.description || undefined,
      clubEmail: clubInfo.clubEmail || undefined,
      clubPhone: clubInfo.clubPhone || undefined,
      address: clubInfo.address || undefined,
      city: clubInfo.city || undefined,
      sportIds: Array.from(this.selectedSportIds())
    };

    this.isSubmitting.set(true);
    this.authService
      .registerClub(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (response) => this.handleSuccess(response),
        error: (error) => this.handleError(error)
      });
  }

  private handleSuccess(response: ClubRegistrationResponse): void {
    this.registrationComplete.set(true);
    
    if (response.stripeOnboardingUrl) {
      this.stripeOnboardingUrl.set(response.stripeOnboardingUrl);
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) {
        const message = error.error?.message || 'Date invalide';
        this.snackbar.show(message);
        return;
      }
      if (error.status === 409) {
        this.snackbar.show('Acest email este deja înregistrat');
        return;
      }
    }
    this.snackbar.show('Nu am putut crea contul. Verifică datele și încearcă din nou.');
  }

  goToStripeOnboarding(): void {
    const url = this.stripeOnboardingUrl();
    if (url && isPlatformBrowser(this.platformId)) {
      window.location.href = url;
    }
  }

  goToDashboard(): void {
    void this.router.navigate(['/club']);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (this.logoUploading()) {
      input.value = '';
      return;
    }

    const file = input.files[0];
    const error = validateImageFile(file);
    if (error) {
      this.snackbar.show(error);
      input.value = '';
      return;
    }
    input.value = '';

    this.logoUploading.set(true);
    void readFileAsDataUrl(file)
      .then((dataUrl) => {
        this.logoPreview.set(dataUrl);

        this.clubService
          .uploadProfileLogo(dataUrl)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.logoUploading.set(false))
          )
          .subscribe({
            next: () => {
              this.snackbar.show('Logo salvat.');
            },
            error: (error) => {
              this.logoPreview.set(null);
              if (error instanceof HttpErrorResponse) {
                const message = error.error?.message || 'Nu am putut salva logo-ul.';
                this.snackbar.show(message);
                return;
              }
              this.snackbar.show('Nu am putut salva logo-ul.');
            }
          });
      })
      .catch(() => {
        this.logoUploading.set(false);
        this.snackbar.show('Nu am putut citi imaginea.');
      });
  }

  removeLogo(): void {
    if (this.logoUploading()) return;
    if (!confirm('Ștergi logo-ul clubului?')) return;

    this.logoUploading.set(true);
    this.clubService
      .deleteProfileLogo()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.logoUploading.set(false))
      )
      .subscribe({
        next: () => {
          this.logoPreview.set(null);
          this.snackbar.show('Logo șters.');
        },
        error: (error) => {
          if (error instanceof HttpErrorResponse) {
            const message = error.error?.message || 'Nu am putut șterge logo-ul.';
            this.snackbar.show(message);
            return;
          }
          this.snackbar.show('Nu am putut șterge logo-ul.');
        }
      });
  }

  onHeroPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (this.heroUploading()) {
      input.value = '';
      return;
    }

    const file = input.files[0];
    const error = validateImageFile(file);
    if (error) {
      this.snackbar.show(error);
      input.value = '';
      return;
    }
    input.value = '';

    this.heroUploading.set(true);
    void readFileAsDataUrl(file)
      .then((dataUrl) => {
        this.heroPhotoPreview.set(dataUrl);

        this.clubService
          .uploadProfileHeroPhoto(dataUrl)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.heroUploading.set(false))
          )
          .subscribe({
            next: () => {
              this.snackbar.show('Coperta a fost salvată.');
            },
            error: (error) => {
              this.heroPhotoPreview.set(null);
              if (error instanceof HttpErrorResponse) {
                const message = error.error?.message || 'Nu am putut salva coperta.';
                this.snackbar.show(message);
                return;
              }
              this.snackbar.show('Nu am putut salva coperta.');
            }
          });
      })
      .catch(() => {
        this.heroUploading.set(false);
        this.snackbar.show('Nu am putut citi imaginea.');
      });
  }

  removeHeroPhoto(): void {
    if (this.heroUploading()) return;
    if (!confirm('Ștergi imaginea de copertă?')) return;

    this.heroUploading.set(true);
    this.clubService
      .deleteProfileHeroPhoto()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.heroUploading.set(false))
      )
      .subscribe({
        next: () => {
          this.heroPhotoPreview.set(null);
          this.snackbar.show('Coperta a fost ștearsă.');
        },
        error: (error) => {
          if (error instanceof HttpErrorResponse) {
            const message = error.error?.message || 'Nu am putut șterge coperta.';
            this.snackbar.show(message);
            return;
          }
          this.snackbar.show('Nu am putut șterge coperta.');
        }
      });
  }
}
