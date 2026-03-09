import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CourseFormComponent } from '../course-form/course-form.component';
import { CourseFormPayload } from '../../services/coach.service';
import { CoachApiService, CoachCourseDetails, CourseScheduleSlot, CreateCoursePayload, LocationOption } from '../../services/coach-api.service';
import { SupabaseService } from '../../../../core/services/supabase.service';

@Component({
  selector: 'app-coach-course-wrapper',
  standalone: true,
  imports: [CommonModule, CourseFormComponent, MatButtonModule, MatIconModule],
  templateUrl: './coach-course-wrapper.component.html',
  styleUrls: ['./coach-course-wrapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachCourseWrapperComponent implements OnInit {
  private readonly coachApiService = inject(CoachApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly courseId = signal<string | null>(null);
  readonly currentCourse = signal<CoachCourseDetails | null>(null);
  readonly courseFormValue = signal<CourseFormPayload | null>(null);
  readonly isSaving = signal(false);
  readonly heroPhotoPreview = signal<string | null>(null);
  readonly heroPhotoFile = signal<File | null>(null);
  readonly galleryPhotos = signal<Array<{ preview: string; file: File }>>([]);
  readonly existingPhotos = signal<Array<{ id: string; displayOrder: number }>>([]);
  readonly isLoadingPhotos = signal(false);
  private readonly supabase = inject(SupabaseService);

  readonly isEditMode = computed(() => Boolean(this.courseId()));

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.courseId.set(id);
      this.loadData(id);
    });
  }

  onSubmit(payload: CourseFormPayload): void {
    if (this.isSaving()) {
      return;
    }

    const courseId = this.courseId();

    this.isSaving.set(true);

    // Convert schedule to recurrenceRule JSON
    const recurrenceRule = this.buildRecurrenceRule(payload.schedule);

    const apiPayload: CreateCoursePayload = {
      name: payload.name,
      sport: payload.sport,
      level: payload.level,
      ageFrom: payload.ageFrom,
      ageTo: payload.ageTo,
      locationId: payload.locationId,
      capacity: payload.capacity,
      price: payload.price,
      pricePerSession: payload.pricePerSession,
      packageOptions: payload.packageOptions,
      description: payload.description,
      recurrenceRule: recurrenceRule,
      active: this.currentCourse()?.active ?? true,
      heroPhoto: this.heroPhotoPreview() || undefined,
      // Club and payment settings
      clubId: payload.clubId,
      paymentRecipient: payload.paymentRecipient
    };

    const operation = courseId
      ? this.coachApiService.updateCourse(courseId, apiPayload)
      : this.coachApiService.createCourse(apiPayload);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (createdCourse) => {
        // Upload gallery photos after course is created/updated
        const targetCourseId = courseId || createdCourse.id;
        const photosToUpload = this.galleryPhotos();

        if (photosToUpload.length > 0) {
          this.uploadGalleryPhotos(targetCourseId, photosToUpload);
        } else {
          this.isSaving.set(false);
          this.snackbar.open(
            courseId ? 'Cursul a fost actualizat' : 'Cursul a fost creat',
            undefined,
            { duration: 4000 }
          );
          void this.router.navigate(['/coach/courses']);
        }
      },
      error: () => {
        this.isSaving.set(false);
        this.snackbar.open('Nu am putut salva cursul', undefined, { duration: 4000 });
      }
    });
  }

  onCancel(): void {
    void this.router.navigate(['/coach/courses']);
  }

  private loadData(courseId: string | null): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.courseFormValue.set(null);

    if (!courseId) {
      // Create mode: keep page usable and show empty form
      this.currentCourse.set(null);
      this.courseFormValue.set(null);
      this.isLoading.set(false);
      return;
    }

    this.coachApiService
      .getCourse(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (course) => {
          this.currentCourse.set(course);
          this.courseFormValue.set(this.mapCourseToPayload(course));
          this.isLoading.set(false);

          // Load existing gallery photos
          this.loadExistingPhotos(courseId);
        },
        error: () => {
          this.loadError.set(true);
          this.courseFormValue.set(null);
          this.isLoading.set(false);
        }
      });
  }

  private mapCourseToPayload(course: CoachCourseDetails): CourseFormPayload {
    return {
      name: course.name,
      sport: course.sport,
      level: course.level ?? '',
      ageFrom: course.ageFrom ?? 8,
      ageTo: course.ageTo ?? 12,
      locationId: course.locationId ?? '',
      locationName: course.location ?? undefined,
      capacity: course.capacity ?? 10,
      price: Number(course.price ?? 0),
      pricePerSession: Number(course.pricePerSession ?? 0),
      packageOptions: course.packageOptions ?? undefined,
      description: course.description ?? undefined,
      schedule: course.scheduleSlots ?? [],
      clubId: course.clubId ?? undefined,
      paymentRecipient: course.paymentRecipient ?? 'COACH'
    };
  }

  onHeroPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Format permis: JPEG, PNG, GIF, WEBP', undefined, {
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

    this.heroPhotoFile.set(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      this.heroPhotoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  removeHeroPhoto(): void {
    this.heroPhotoFile.set(null);
    this.heroPhotoPreview.set(null);
  }

  getHeroPhotoUrl(): string | null {
    const courseId = this.courseId();
    const currentCourse = this.currentCourse();
    if (courseId && currentCourse?.hasHeroPhoto) {
      const { data } = this.supabase.storage('course-photos').getPublicUrl(`${courseId}/hero`);
      return data?.publicUrl ?? null;
    }
    return null;
  }

  onGalleryPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Format permis: JPEG, PNG, GIF, WEBP', undefined, {
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

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      const currentPhotos = this.galleryPhotos();
      this.galleryPhotos.set([...currentPhotos, { preview: reader.result as string, file }]);
    };
    reader.readAsDataURL(file);

    // Reset input
    input.value = '';
  }

  removeGalleryPhoto(index: number): void {
    const currentPhotos = this.galleryPhotos();
    this.galleryPhotos.set(currentPhotos.filter((_, i) => i !== index));
  }

  deleteExistingPhoto(photoId: string): void {
    const courseId = this.courseId();
    if (!courseId) {
      return;
    }

    if (!confirm('Ești sigur că vrei să ștergi această fotografie?')) {
      return;
    }

    this.coachApiService
      .deleteCoursePhoto(courseId, photoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Fotografia a fost ștearsă', undefined, { duration: 3000 });
          this.loadExistingPhotos(courseId);
        },
        error: () => {
          this.snackbar.open('Nu am putut șterge fotografia', undefined, { duration: 4000 });
        }
      });
  }

  getExistingPhotoUrl(photoId: string): string {
    const courseId = this.courseId();
    if (!courseId) {
      return '';
    }
    return this.coachApiService.getCoursePhotoUrl(courseId, photoId);
  }

  private loadExistingPhotos(courseId: string): void {
    this.isLoadingPhotos.set(true);
    this.coachApiService
      .getCoursePhotos(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          this.existingPhotos.set(photos);
          this.isLoadingPhotos.set(false);
        },
        error: () => {
          this.existingPhotos.set([]);
          this.isLoadingPhotos.set(false);
        }
      });
  }

  private uploadGalleryPhotos(courseId: string, photos: Array<{ preview: string; file: File }>): void {
    let uploadedCount = 0;
    const totalPhotos = photos.length;

    photos.forEach((photo) => {
      this.coachApiService
        .uploadCoursePhoto(courseId, photo.preview)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            uploadedCount++;
            if (uploadedCount === totalPhotos) {
              this.isSaving.set(false);
              this.snackbar.open(
                `Cursul a fost ${this.courseId() ? 'actualizat' : 'creat'} și ${totalPhotos} ${
                  totalPhotos === 1 ? 'fotografie a fost încărcată' : 'fotografii au fost încărcate'
                }`,
                undefined,
                { duration: 4000 }
              );
              void this.router.navigate(['/coach/courses']);
            }
          },
          error: () => {
            uploadedCount++;
            if (uploadedCount === totalPhotos) {
              this.isSaving.set(false);
              this.snackbar.open(
                'Cursul a fost salvat, dar unele fotografii nu au putut fi încărcate',
                undefined,
                { duration: 4000 }
              );
              void this.router.navigate(['/coach/courses']);
            }
          }
        });
    });
  }

  private buildRecurrenceRule(schedule: CourseScheduleSlot[]): string {
    const dayMap: Record<string, number> = {
      'monday': 1,
      'MONDAY': 1,
      'tuesday': 2,
      'TUESDAY': 2,
      'wednesday': 3,
      'WEDNESDAY': 3,
      'thursday': 4,
      'THURSDAY': 4,
      'friday': 5,
      'FRIDAY': 5,
      'saturday': 6,
      'SATURDAY': 6,
      'sunday': 7,
      'SUNDAY': 7
    };

    const daySchedules: Record<string, { start: string; end: string }> = {};

    schedule.forEach(slot => {
      // Only include slots with valid start and end times
      if (!slot.startTime || !slot.endTime) {
        return;
      }
      
      const dayNumber = dayMap[slot.day];
      if (dayNumber) {
        daySchedules[dayNumber.toString()] = {
          start: slot.startTime,
          end: slot.endTime
        };
      }
    });

    return JSON.stringify({ daySchedules });
  }
}

