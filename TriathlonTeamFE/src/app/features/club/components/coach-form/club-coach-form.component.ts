import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SportService } from '../../../admin/services/sport.service';
import { Sport } from '../../../admin/services/models/sport.model';
import {
  ClubCoachDetail,
  ClubService,
  CreateClubCoachRequest,
  UpdateClubCoachRequest
} from '../../services/club.service';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

@Component({
  selector: 'app-club-coach-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './club-coach-form.component.html',
  styleUrls: ['./club-coach-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubCoachFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly clubService = inject(ClubService);
  private readonly sportService = inject(SportService);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  readonly coachId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly showPassword = signal(false);

  readonly sportsLoading = signal(true);
  readonly availableSports = signal<Sport[]>([]);

  readonly photoPreview = signal<string | null>(null);
  readonly photoFile = signal<File | null>(null);

  readonly loadedCoach = signal<ClubCoachDetail | null>(null);

  readonly isEditMode = computed(() => Boolean(this.coachId()));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [this.optionalPhoneValidator()]],
    bio: [''],
    sportIds: [[] as string[]]
  });

  constructor() {
    this.loadSports();
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.coachId.set(id);
      this.loadData(id);
    });
  }

  onCancel(): void {
    void this.router.navigate(['/club/coaches']);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Formatul permis: JPEG, PNG, GIF, WEBP', undefined, {
        duration: 4000
      });
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      this.snackbar.open('Imaginea este prea mare. Dimensiunea maximă: 10MB', undefined, {
        duration: 4000
      });
      input.value = '';
      return;
    }

    this.photoFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input so selecting the same file again triggers change
    input.value = '';
  }

  removePhoto(): void {
    this.photoFile.set(null);
    this.photoPreview.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const coachId = this.coachId();

    this.isSaving.set(true);

    if (coachId) {
      const payload: UpdateClubCoachRequest = {
        name: value.name.trim(),
        email: value.email.trim(),
        phone: value.phone?.trim() ? value.phone.trim() : null,
        bio: value.bio?.trim() ? value.bio.trim() : null,
        sportIds: value.sportIds ?? []
      };

      if (value.password && value.password.trim()) {
        payload.password = value.password;
      }

      if (this.photoPreview()) {
        payload.photo = this.photoPreview()!;
      }

      this.clubService
        .updateCoach(coachId, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackbar.open('Antrenorul a fost actualizat cu succes!', undefined, { duration: 4000 });
            void this.router.navigate(['/club/coaches']);
          },
          error: (err) => {
            this.isSaving.set(false);
            const message = err?.error?.message || 'Nu am putut actualiza antrenorul';
            this.snackbar.open(message, undefined, { duration: 6000 });
          }
        });
    } else {
      const request: CreateClubCoachRequest = {
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
        phone: value.phone?.trim() ? value.phone.trim() : undefined,
        bio: value.bio?.trim() ? value.bio.trim() : undefined,
        sportIds: value.sportIds?.length ? value.sportIds : undefined,
        photo: this.photoPreview() || undefined
      };

      this.clubService
        .createCoach(request)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (coach) => {
            this.isSaving.set(false);
            this.snackbar.open(`Antrenorul ${coach.name} a fost creat cu succes!`, undefined, {
              duration: 4000
            });
            void this.router.navigate(['/club/coaches']);
          },
          error: (err) => {
            this.isSaving.set(false);
            const message = err?.error?.message || 'Nu am putut crea antrenorul';
            this.snackbar.open(message, undefined, { duration: 6000 });
          }
        });
    }
  }

  trackBySportId = (_: number, sport: Sport) => sport.id;

  getExistingPhotoUrl(): string | null {
    const coach = this.loadedCoach();
    if (!coach?.userId || !coach.hasPhoto) return null;
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    return `${base}/api/public/coaches/${coach.userId}/photo`;
  }

  private loadSports(): void {
    this.sportsLoading.set(true);
    this.sportService
      .getSports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => {
          this.availableSports.set(sports ?? []);
          this.sportsLoading.set(false);
        },
        error: () => {
          this.availableSports.set([]);
          this.sportsLoading.set(false);
        }
      });
  }

  private loadData(coachId: string | null): void {
    this.isLoading.set(true);
    this.loadedCoach.set(null);
    this.photoPreview.set(null);
    this.photoFile.set(null);

    if (!coachId) {
      // Create mode: password is required
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
      this.form.controls.password.updateValueAndValidity();
      this.isLoading.set(false);
      return;
    }

    // Edit mode: password is optional
    this.form.controls.password.setValidators([Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.password.setValue('');

    this.clubService
      .getCoachById(coachId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coach) => {
          this.loadedCoach.set(coach);
          this.form.patchValue({
            name: coach.name,
            email: coach.email,
            password: '',
            phone: coach.phone || '',
            bio: coach.bio || '',
            sportIds: coach.sportIds || []
          });
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          const message = err?.error?.message || 'Nu am putut încărca antrenorul';
          this.snackbar.open(message, undefined, { duration: 6000 });
          void this.router.navigate(['/club/coaches']);
        }
      });
  }

  private optionalPhoneValidator(): ValidatorFn {
    const re = /^\+?[0-9]{8,15}$/;
    return (control) => {
      const raw = String(control.value ?? '').trim();
      if (!raw) {
        return null;
      }
      return re.test(raw) ? null : { phone: true };
    };
  }
}


