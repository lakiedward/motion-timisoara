import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachService, CoachActivityPayload } from '../../services/coach.service';

interface Location {
  id: string;
  name: string;
}

interface Sport {
  code: string;
  name: string;
}

@Component({
  selector: 'app-coach-activity-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  templateUrl: './coach-activity-form.component.html',
  styleUrls: ['./coach-activity-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachActivityFormComponent implements OnInit {
  private readonly coachService = inject(CoachService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isEditMode = signal(false);
  readonly activityId = signal<string | null>(null);

  readonly locations = signal<Location[]>([]);
  readonly sports = signal<Sport[]>([]);

  // Hero photo
  readonly heroPhoto = signal<string | null>(null);
  readonly isUploadingPhoto = signal(false);

  form!: FormGroup;

  // Regex for 24h time format (HH:MM)
  private readonly timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  ngOnInit(): void {
    this.initForm();
    this.loadDropdownData();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.activityId.set(id);
      this.loadActivity(id);
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      sport: ['', Validators.required],
      locationId: ['', Validators.required],
      activityDate: ['', Validators.required],
      startTime: ['', [Validators.required, Validators.pattern(this.timePattern)]],
      endTime: ['', [Validators.required, Validators.pattern(this.timePattern)]],
      price: [0, [Validators.required, Validators.min(0)]],
      capacity: [null],
      active: [true]
    });
  }

  /**
   * Auto-format time input: adds colon after 2 digits
   */
  formatTimeInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');
    
    if (value.length >= 2) {
      value = value.substring(0, 2) + ':' + value.substring(2, 4);
    }
    
    value = value.substring(0, 5);
    input.value = value;
    this.form.get(controlName)?.setValue(value, { emitEvent: false });
  }

  private loadDropdownData(): void {
    // Load locations
    this.http.get<Location[]>('/api/public/locations')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => this.locations.set(locations),
        error: () => this.snackbar.open('Nu am putut încărca lista de locații', undefined, { duration: 3000 })
      });

    // Load sports
    this.http.get<Sport[]>('/api/public/sports')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => this.sports.set(sports),
        error: () => this.snackbar.open('Nu am putut încărca lista de sporturi', undefined, { duration: 3000 })
      });
  }

  private loadActivity(id: string): void {
    this.isLoading.set(true);
    this.coachService.getActivityById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activity) => {
          this.form.patchValue({
            name: activity.name,
            description: activity.description || '',
            sport: activity.sport,
            locationId: activity.locationId,
            activityDate: activity.activityDate,
            startTime: activity.startTime,
            endTime: activity.endTime,
            // BE stores money in bani; display in RON
            price: (Number(activity.price ?? 0) / 100),
            capacity: activity.capacity,
            active: activity.active
          });
          if (activity.hasHeroPhoto) {
            this.loadHeroPhoto(id);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut încărca activitatea', undefined, { duration: 4000 });
          void this.router.navigate(['/coach/activities']);
        }
      });
  }

  private loadHeroPhoto(id: string): void {
    this.coachService.getActivityHeroPhoto(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.heroPhoto.set(response.photo),
        error: () => {}
      });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snackbar.open('Selectează o imagine validă', undefined, { duration: 3000 });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.snackbar.open('Imaginea trebuie să fie mai mică de 10MB', undefined, { duration: 3000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      
      if (this.isEditMode() && this.activityId()) {
        this.uploadPhoto(base64);
      } else {
        this.heroPhoto.set(base64);
      }
    };
    reader.readAsDataURL(file);
  }

  private uploadPhoto(base64: string): void {
    const id = this.activityId();
    if (!id) return;

    this.isUploadingPhoto.set(true);
    this.coachService.uploadActivityHeroPhoto(id, base64)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.heroPhoto.set(base64);
          this.isUploadingPhoto.set(false);
          this.snackbar.open('Poza a fost încărcată', undefined, { duration: 2000 });
        },
        error: () => {
          this.isUploadingPhoto.set(false);
          this.snackbar.open('Nu am putut încărca poza', undefined, { duration: 3000 });
        }
      });
  }

  deletePhoto(): void {
    const id = this.activityId();
    
    if (!this.isEditMode() || !id) {
      this.heroPhoto.set(null);
      return;
    }

    this.isUploadingPhoto.set(true);
    this.coachService.deleteActivityHeroPhoto(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.heroPhoto.set(null);
          this.isUploadingPhoto.set(false);
          this.snackbar.open('Poza a fost ștearsă', undefined, { duration: 2000 });
        },
        error: () => {
          this.isUploadingPhoto.set(false);
          this.snackbar.open('Nu am putut șterge poza', undefined, { duration: 3000 });
        }
      });
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const value = this.form.value;

    const payload: CoachActivityPayload = {
      name: value.name,
      description: value.description || null,
      sport: value.sport,
      locationId: value.locationId,
      activityDate: value.activityDate,
      startTime: value.startTime,
      endTime: value.endTime,
      // UI input is RON; BE expects bani (Long)
      price: this.toBani(value.price),
      capacity: value.capacity || null,
      active: value.active ?? true
    };

    const request$ = this.isEditMode()
      ? this.coachService.updateActivity(this.activityId()!, payload)
      : this.coachService.createActivity(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.snackbar.open(
          this.isEditMode() ? 'Activitatea a fost actualizată' : 'Activitatea a fost creată',
          undefined,
          { duration: 3000 }
        );
        void this.router.navigate(['/coach/activities']);
      },
      error: (err) => {
        this.isSaving.set(false);
        const message = err?.error?.message || 'Nu am putut salva activitatea';
        this.snackbar.open(message, undefined, { duration: 4000 });
      }
    });
  }

  goBack(): void {
    void this.router.navigate(['/coach/activities']);
  }

  private toBani(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return 0;
    }
    return Math.round(amount * 100);
  }
}
