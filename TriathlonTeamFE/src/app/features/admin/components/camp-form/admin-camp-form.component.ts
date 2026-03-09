import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { AdminCamp, AdminCampPayload } from '../../services/models/admin-camp.model';

@Component({
  selector: 'app-admin-camp-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule],
  templateUrl: './admin-camp-form.component.html',
  styleUrls: ['./admin-camp-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCampFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly isEditMode = signal(false);
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Editeaza tabara' : 'Creeaza tabara'));

  private currentCamp: AdminCamp | null = null;

  private readonly periodValidator = (control: AbstractControl): ValidationErrors | null => {
    const start = control.get('periodStart')?.value;
    const end = control.get('periodEnd')?.value;
    if (!start || !end) {
      return null;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    return endDate >= startDate ? null : { invalidPeriod: true };
  };

  readonly form = this.fb.group(
    {
      title: ['', [Validators.required, Validators.minLength(3)]],
      periodStart: ['', Validators.required],
      periodEnd: ['', Validators.required],
      locationText: [''],
      price: [null as number | null, [Validators.required, Validators.min(0)]],
      capacity: [null as number | null, Validators.min(1)],
      allowCash: [false],
      description: [''],
      imageUrls: ['']
    },
    { validators: this.periodValidator }
  );

  readonly galleryPreview = toSignal(
    this.form.controls.imageUrls.valueChanges.pipe(
      map((value) => this.extractGallery(value || ''))
    ),
    { initialValue: [] }
  );

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const campId = params.get('campId');
          if (!campId) {
            this.isEditMode.set(false);
            this.currentCamp = null;
            this.resetForm();
            this.isLoading.set(false);
            return of<AdminCamp | null>(null);
          }
          this.isEditMode.set(true);
          this.isLoading.set(true);
          return this.adminService.getAllCamps().pipe(
            map((camps) => camps?.find((camp) => camp.id === campId) ?? null)
          );
        })
      )
      .subscribe({
        next: (camp) => {
          if (this.isEditMode() && !camp) {
            this.handleMissingCamp();
            return;
          }
          if (camp) {
            this.currentCamp = camp;
            this.populateForm(camp);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut incarca datele taberei.', undefined, { duration: 4000 });
          void this.router.navigate(['/admin', 'camps']);
        }
      });
  }

  get periodInvalid(): boolean {
    return (
      this.form.hasError('invalidPeriod') &&
      (this.form.get('periodStart')?.touched || this.form.get('periodEnd')?.touched || this.isSubmitting())
    );
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched || this.isSubmitting());
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const {
      title,
      periodStart,
      periodEnd,
      locationText,
      price,
      capacity,
      allowCash,
      description,
      imageUrls
    } = this.form.value;

    const trimmedTitle = (title ?? '').trim();
    const slug = this.currentCamp?.slug ?? this.generateSlug(trimmedTitle);
    const galleryUrls = this.extractGallery(imageUrls ?? '');
    const payload: AdminCampPayload = {
      title: trimmedTitle,
      slug,
      description: this.normalizeOptional(description),
      periodStart: periodStart!,
      periodEnd: periodEnd!,
      locationText: this.normalizeOptional(locationText),
      // UI input is RON; BE expects bani (Long)
      price: this.toBani(price),
      allowCash: Boolean(allowCash),
      galleryJson: galleryUrls.length ? JSON.stringify(galleryUrls) : null
    };

    if (capacity !== null && capacity !== undefined) {
      payload.capacity = Number(capacity);
    }

    this.isSubmitting.set(true);
    const request$ = this.isEditMode() && this.currentCamp
      ? this.adminService.updateCamp(this.currentCamp.id, payload)
      : this.adminService.createCamp(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: () => {
          this.snackbar.open('Tabara a fost salvata cu succes.', undefined, { duration: 3500 });
          void this.router.navigate(['/admin', 'camps']);
        },
        error: () => {
          this.snackbar.open('Nu am putut salva tabara. Incercati din nou.', undefined, { duration: 4000 });
        }
      });
  }

  cancel(): void {
    void this.router.navigate(['/admin', 'camps']);
  }

  private populateForm(camp: AdminCamp): void {
    this.form.patchValue({
      title: camp.title,
      periodStart: camp.periodStart,
      periodEnd: camp.periodEnd,
      locationText: camp.locationText ?? '',
      // BE stores money in bani; display in RON
      price: (Number(camp.price ?? 0) / 100),
      capacity: camp.capacity ?? null,
      allowCash: camp.allowCash,
      description: camp.description ?? '',
      imageUrls: this.parseGallery(camp.galleryJson)
    });
    this.form.markAsPristine();
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      periodStart: '',
      periodEnd: '',
      locationText: '',
      price: null,
      capacity: null,
      allowCash: false,
      description: '',
      imageUrls: ''
    });
    this.form.markAsPristine();
  }

  private parseGallery(galleryJson?: string | null): string {
    if (!galleryJson) {
      return '';
    }
    try {
      const parsed = JSON.parse(galleryJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
          .join('\n');
      }
    } catch (error) {
      console.warn('Nu am putut parsa imaginile taberei', error);
    }
    return galleryJson;
  }

  private extractGallery(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private generateSlug(input: string): string {
    const safeInput = input || 'tabara';
    const normalized = safeInput
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || `tabara-${Date.now()}`;
  }

  private handleMissingCamp(): void {
    this.isLoading.set(false);
    this.snackbar.open('Tabara nu a fost gasita.', undefined, { duration: 4000 });
    void this.router.navigate(['/admin', 'camps']);
  }

  private normalizeOptional(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }

  private toBani(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return 0;
    }
    return Math.round(amount * 100);
  }
}
