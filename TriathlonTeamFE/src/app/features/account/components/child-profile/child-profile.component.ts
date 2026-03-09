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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ChildrenService, Child, ChildPayload } from '../../services/children.service';
import { finalize } from 'rxjs/operators';
import { of, switchMap } from 'rxjs';
import { EnrollmentService, ParentEnrollmentListItem } from '../../services/enrollment.service';

@Component({
  selector: 'app-child-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './child-profile.component.html',
  styleUrls: ['./child-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChildProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly childrenService = inject(ChildrenService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isNew = signal(true);
  readonly isLoading = signal(true);
  readonly submitState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly loadError = signal(false);

  private currentChildId: string | null = null;
  readonly photoUrl = signal<string | null>(null);
  readonly enrollments = signal<ParentEnrollmentListItem[]>([]);

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    birthDate: this.fb.nonNullable.control('', Validators.required),
    level: this.fb.control<string | null>(null),
    allergies: this.fb.control<string | null>(null),
    emergencyContactName: this.fb.control<string | null>(null),
    emergencyPhone: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9+ ]{6,20}$/)]),
    secondaryContactName: this.fb.control<string | null>(null),
    secondaryPhone: this.fb.control<string | null>(null),
    tshirtSize: this.fb.control<string | null>(null),
    gdprConsent: this.fb.control({ value: true, disabled: true })
  });

  readonly title = computed(() => (this.isNew() ? 'Adauga copil' : 'Editeaza profilul copilului'));
  readonly age = computed(() => {
    const bd = this.form.controls.birthDate.value;
    if (!bd) return null;
    const birth = new Date(bd);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if (beforeBirthday) years -= 1;
    return Math.max(years, 0);
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = params.get('id');
          if (!id || id === 'new') {
            this.isNew.set(true);
            this.isLoading.set(false);
            this.form.reset({});
            this.form.patchValue({
              name: '',
              birthDate: '',
              level: '',
              allergies: '',
              emergencyContactName: '',
              emergencyPhone: '',
              secondaryContactName: '',
              secondaryPhone: '',
              tshirtSize: '',
              gdprConsent: true
            });
            this.currentChildId = null;
            this.photoUrl.set(null);
            return of(null);
          }
          this.isNew.set(false);
          this.currentChildId = id;
          this.isLoading.set(true);
          this.loadError.set(false);
          return this.childrenService.getChild(id).pipe(finalize(() => this.isLoading.set(false)));
        })
      )
      .subscribe({
        next: (child) => {
          if (!child) {
            return;
          }
          this.patchForm(child);
          if (this.currentChildId) {
            this.photoUrl.set(this.childrenService.getChildPhotoUrl(this.currentChildId));
            this.enrollmentService
              .getEnrollments()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe((items) => {
                this.enrollments.set((items ?? []).filter((e) => e.childId === this.currentChildId));
              });
          }
        },
        error: () => {
          this.loadError.set(true);
        }
      });
  }

  private patchForm(child: Child): void {
    this.form.patchValue({
      name: child.name,
      birthDate: child.birthDate ?? '',
      level: child.level ?? '',
      allergies: child.allergies ?? '',
      emergencyContactName: child.emergencyContactName ?? '',
      emergencyPhone: child.emergencyPhone ?? '',
      secondaryContactName: child.secondaryContactName ?? '',
      secondaryPhone: child.secondaryPhone ?? '',
      tshirtSize: child.tshirtSize ?? '',
      gdprConsent: !!child.gdprConsentAt
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload: ChildPayload = {
      name: raw.name.trim(),
      birthDate: this.normalizeDate(raw.birthDate),
      level: raw.level?.trim() || undefined,
      allergies: raw.allergies?.trim() || undefined,
      emergencyContactName: raw.emergencyContactName?.trim() || undefined,
      emergencyPhone: raw.emergencyPhone.trim(),
      secondaryContactName: raw.secondaryContactName?.trim() || undefined,
      secondaryPhone: raw.secondaryPhone?.trim() || undefined,
      tshirtSize: raw.tshirtSize?.trim() || undefined
    };

    this.submitState.set('loading');

    this.childrenService
      .saveChild(this.currentChildId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitState.set('idle');
          void this.router.navigate(['/account']);
        },
        error: () => {
          this.submitState.set('error');
        }
      });
  }

  cancel(): void {
    void this.router.navigate(['/account']);
  }

  private normalizeDate(value: string | null | undefined): string {
    return value?.trim() ?? '';
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.currentChildId) {
      return;
    }

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > maxSize) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.childrenService
        .uploadChildPhoto(this.currentChildId!, base64)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.photoUrl.set(this.childrenService.getChildPhotoUrl(this.currentChildId!));
        });
    };
    reader.readAsDataURL(file);
  }

  onPhotoError(): void {
    this.photoUrl.set(null);
  }

  trackByEnrollment(_: number, e: ParentEnrollmentListItem): string {
    return e.id;
  }
}
