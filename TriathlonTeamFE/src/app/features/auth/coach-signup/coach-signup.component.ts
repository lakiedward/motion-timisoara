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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorSnackbarService } from '../../../shared/services/error-snackbar.service';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { CoachRegistrationResponse } from '../../../core/models/auth';
import { SportService } from '../../admin/services/sport.service';
import { Sport } from '../../admin/services/models/sport.model';

@Component({
  selector: 'app-coach-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatStepperModule,
    MatCheckboxModule,
    FormErrorComponent
  ],
  templateUrl: './coach-signup.component.html',
  styleUrls: ['./coach-signup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachSignupComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sportService = inject(SportService);

  // Step 1: Basic Info
  readonly basicInfoForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]]
  });

  // Step 2: Invitation Code
  readonly invitationForm = this.fb.nonNullable.group({
    invitationCode: ['', [Validators.required, Validators.minLength(5)]]
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
    
    // Step 0: Validate invitation code first
    if (step === 0 && this.invitationForm.invalid) {
      this.invitationForm.markAllAsTouched();
      return;
    }
    
    // Step 1: Validate basic info
    if (step === 1 && this.basicInfoForm.invalid) {
      this.basicInfoForm.markAllAsTouched();
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
    if (this.basicInfoForm.invalid || this.invitationForm.invalid) {
      this.basicInfoForm.markAllAsTouched();
      this.invitationForm.markAllAsTouched();
      return;
    }

    const basicInfo = this.basicInfoForm.getRawValue();
    const invitationInfo = this.invitationForm.getRawValue();

    const request = {
      name: basicInfo.name,
      email: basicInfo.email,
      password: basicInfo.password,
      phone: basicInfo.phone,
      invitationCode: invitationInfo.invitationCode,
      sportIds: Array.from(this.selectedSportIds())
    };

    this.isSubmitting.set(true);
    this.authService
      .registerCoach(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (response) => this.handleSuccess(response),
        error: (error) => this.handleError(error)
      });
  }

  private handleSuccess(response: CoachRegistrationResponse): void {
    this.registrationComplete.set(true);
    
    if (response.stripeOnboardingUrl) {
      this.stripeOnboardingUrl.set(response.stripeOnboardingUrl);
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) {
        const message = error.error?.message || 'Cod de invitație invalid sau expirat';
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
    void this.router.navigate(['/coach']);
  }
}
