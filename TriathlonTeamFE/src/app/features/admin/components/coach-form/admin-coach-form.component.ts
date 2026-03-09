import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService } from '../../services/admin.service';
import { SportService } from '../../services/sport.service';
import {
  AdminCoachListItem,
  InviteCoachPayload,
  UpdateCoachPayload
} from '../../services/models/admin-coach.model';
import { Sport } from '../../services/models/sport.model';

@Component({
  selector: 'app-admin-coach-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './admin-coach-form.component.html',
  styleUrls: ['./admin-coach-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCoachFormComponent implements OnInit {
  private readonly api = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sportService = inject(SportService);

  readonly coachId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly isSaving = signal(false);
  readonly availableSports = signal<Sport[]>([]);
  readonly photoPreview = signal<string | null>(null);
  readonly photoFile = signal<File | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    phone: [''],
    bio: [''],
    sportIds: [[] as string[]]
  });

  readonly isEditMode = computed(() => Boolean(this.coachId()));

  ngOnInit(): void {
    // Load available sports
    this.sportService
      .getSports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => this.availableSports.set(sports),
        error: () => this.availableSports.set([])
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.coachId.set(id);
      this.loadData(id);
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    const coachId = this.coachId();

    this.isSaving.set(true);

    if (coachId) {
      // Edit mode
      const payload: UpdateCoachPayload = {
        name: formValue.name,
        email: formValue.email || undefined,
        phone: formValue.phone || undefined,
        bio: formValue.bio || undefined,
        sportIds: formValue.sportIds || undefined
      };

      // Only include password if it was provided
      if (formValue.password && formValue.password.trim()) {
        payload.password = formValue.password;
      }

      // Include photo if available
      if (this.photoPreview()) {
        payload.photo = this.photoPreview()!;
      }

      this.api
        .updateCoach(coachId, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackbar.open('Antrenorul a fost actualizat cu succes', undefined, {
              duration: 4000
            });
            void this.router.navigate(['/admin/coaches']);
          },
          error: () => {
            this.isSaving.set(false);
            this.snackbar.open('Nu am putut actualiza antrenorul', undefined, { duration: 4000 });
          }
        });
    } else {
      // Create mode
      const payload: InviteCoachPayload = {
        name: formValue.name,
        email: formValue.email,
        password: formValue.password || '',
        phone: formValue.phone || undefined,
        bio: formValue.bio || undefined,
        sportIds: formValue.sportIds || undefined
      };

      // Include photo if available
      if (this.photoPreview()) {
        payload.photo = this.photoPreview()!;
      }

      this.api
        .inviteCoach(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackbar.open('Antrenorul a fost creat cu succes', undefined, { duration: 4000 });
            void this.router.navigate(['/admin/coaches']);
          },
          error: () => {
            this.isSaving.set(false);
            this.snackbar.open('Nu am putut crea antrenorul', undefined, { duration: 4000 });
          }
        });
    }
  }

  onCancel(): void {
    void this.router.navigate(['/admin/coaches']);
  }

  private loadData(coachId: string | null): void {
    this.isLoading.set(true);
    this.loadError.set(false);

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

    this.api
      .getCoachById(coachId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coach: AdminCoachListItem) => {
          this.form.patchValue({
            name: coach.name,
            email: coach.email,
            password: '',
            phone: coach.phone || '',
            bio: coach.bio || '',
            sportIds: coach.sports.map((s) => s.id)
          });
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.isLoading.set(false);
        }
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Formatul permis: JPEG, PNG, GIF, WEBP', undefined, {
        duration: 4000
      });
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      this.snackbar.open('Imaginea este prea mare. Dimensiunea maximă: 10MB', undefined, {
        duration: 4000
      });
      return;
    }

    this.photoFile.set(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoFile.set(null);
    this.photoPreview.set(null);
  }

  getPhotoUrl(): string | null {
    const coachId = this.coachId();
    if (coachId) {
      return this.api.getCoachPhotoUrl(coachId);
    }
    return null;
  }

  getSelectedSportNames(): string[] {
    const selectedIds = this.form.value.sportIds || [];
    const allSports = this.availableSports();
    return allSports.filter((s) => selectedIds.includes(s.id)).map((s) => s.name);
  }
}



