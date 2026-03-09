import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService } from '../../services/admin.service';
import { AdminCoachListItem } from '../../services/models/admin-coach.model';
import { AdminCourseDetail, AdminCoursePayload, CoursePhotoItem } from '../../services/models/admin-course.model';
import { CourseFormComponent } from '../../../coach/components/course-form/course-form.component';
import { CourseFormPayload } from '../../../coach/services/coach.service';
import { timer, Subject, EMPTY, merge, from, of } from 'rxjs';
import { switchMap, tap, finalize, catchError, takeUntil, share, ignoreElements, defaultIfEmpty, concatMap, toArray, map } from 'rxjs/operators';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

@Component({
  selector: 'app-admin-course-form',
  standalone: true,
  imports: [CommonModule, CourseFormComponent, MatSelectModule, MatButtonModule, MatIconModule],
  templateUrl: './admin-course-form.component.html',
  styleUrls: ['./admin-course-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCourseFormComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  // Subject to trigger reorder requests.
  private readonly reorderRequests = new Subject<{ courseId: string; photoIds: string[] }>();

  readonly coaches = signal<AdminCoachListItem[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly courseId = signal<string | null>(null);
  readonly selectedCoachId = signal<string | null>(null);
  readonly currentCourse = signal<AdminCourseDetail | null>(null);
  readonly courseFormValue = signal<CourseFormPayload | null>(null);
  readonly isSaving = signal(false);
  readonly heroPhotoPreview = signal<string | null>(null);
  readonly heroPhotoFile = signal<File | null>(null);
  readonly galleryPhotos = signal<Array<{ preview: string; file: File }>>([]);
  readonly existingPhotos = signal<CoursePhotoItem[]>([]);
  readonly isLoadingPhotos = signal(false);
  readonly heroPhotoUploading = signal(false);
  readonly heroPhotoBust = signal(0);

  // Gallery Reordering State
  readonly galleryReordering = signal(false);


  readonly selectedCoach = computed(() => {
    const id = this.selectedCoachId();
    if (!id) {
      return null;
    }
    return this.coaches().find((coach) => coach.id === id) ?? null;
  });
  readonly isEditMode = computed(() => Boolean(this.courseId()));

  readonly galleryBusy = computed(() => {
    return this.isSaving() || this.galleryReordering() || this.isLoadingPhotos();
  });

  constructor() {
    this.reorderRequests
      .pipe(
        takeUntilDestroyed(),
        switchMap(({ courseId, photoIds }) => {
          const request$ = this.adminService.reorderCoursePhotos(courseId, photoIds).pipe(
            tap({
              error: (err) => {
                console.error('Error saving gallery order', { courseId, photoIds, err });
                this.snackbar.open('Nu am putut salva ordinea fotografiilor', undefined, { duration: 4000 });
                // Revert or reload on error
                this.loadExistingPhotos(courseId);
              }
            }),
            catchError(() => EMPTY),
            share()
          );

          return merge(
            request$,
            timer(250).pipe(
              tap(() => this.galleryReordering.set(true)),
              takeUntil(request$.pipe(defaultIfEmpty(null))),
              ignoreElements()
            )
          ).pipe(
            finalize(() => this.galleryReordering.set(false))
          );
        })
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.courseId.set(id);
      this.loadData(id);
    });
  }

  onCoachChange(coachId: string): void {
    this.selectedCoachId.set(coachId);
  }

  onSubmit(payload: CourseFormPayload): void {
    if (this.isSaving()) {
      return;
    }

    if (this.heroPhotoUploading()) {
      this.snackbar.open('Așteaptă salvarea Hero Photo', undefined, { duration: 3000 });
      return;
    }

    const courseId = this.courseId();
    const coachId = this.selectedCoachId();
    if (!coachId) {
      this.snackbar.open('Selecteaza un antrenor inainte de a salva.', undefined, { duration: 4000 });
      return;
    }

    const adminPayload: AdminCoursePayload = {
      coachId,
      course: {
        ...payload,
        heroPhoto: this.heroPhotoPreview() || undefined
      },
      // Always send a non-null string; omit the field if empty to avoid BE non-null errors
      recurrenceRule: this.buildRecurrenceRule(payload?.schedule) || undefined,
      active: this.currentCourse()?.active ?? true
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - ngDevMode is provided by Angular at build time
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      // eslint-disable-next-line no-console
      console.debug('[AdminCourseForm] Submitting payload', {
        courseId,
        coachId,
        adminPayload
      });
    }

    this.isSaving.set(true);

    (courseId ? this.adminService.updateCourse(courseId, adminPayload) : this.adminService.createCourse(adminPayload))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (createdCourse) => {
          // Upload gallery photos after course is created/updated
          const targetCourseId = courseId || createdCourse.id;
          const photosToUpload = this.galleryPhotos();

          if (photosToUpload.length > 0) {
            this.uploadGalleryPhotos(targetCourseId, photosToUpload);
          } else {
            this.isSaving.set(false);
            this.snackbar.open(courseId ? 'Cursul a fost actualizat' : 'Cursul a fost creat', undefined, { duration: 4000 });
            void this.router.navigate(['/admin/courses']);
          }
        },
        error: () => {
          this.isSaving.set(false);
          this.snackbar.open('Nu am putut salva cursul', undefined, { duration: 4000 });
        }
      });
  }

  onCancel(): void {
    void this.router.navigate(['/admin/courses']);
  }

  private loadData(courseId: string | null): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.courseFormValue.set(null);
    this.selectedCoachId.set(null);

    this.adminService
      .getAllCoaches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coaches) => this.coaches.set(coaches ?? []),
        error: () => this.coaches.set([])
      });

    if (!courseId) {
      // Create mode: keep page usable and show empty form
      this.currentCourse.set(null);
      this.courseFormValue.set(null);
      this.isLoading.set(false);
      return;
    }

    this.adminService
      .getCourseById(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (course) => {
          this.currentCourse.set(course);
          this.selectedCoachId.set(course.coachId);
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
  private mapCourseToPayload(course: AdminCourseDetail): CourseFormPayload {
    const price = Number(course.price ?? 0);
    const pricePerSessionRaw = Number(course.pricePerSession ?? 0);
    // Backward compatibility: some older courses may not have pricePerSession persisted.
    // CourseForm expects 'pricePerSession' in bani, and the monthly price is computed as pricePerSession * 8.
    const pricePerSession = pricePerSessionRaw > 0 ? pricePerSessionRaw : price > 0 ? Math.round(price / 8) : 0;
    return {
      name: course.name,
      sport: course.sport,
      level: course.level ?? '',
      ageFrom: course.ageFrom ?? 8,
      ageTo: course.ageTo ?? 12,
      locationId: course.locationId ?? '',
      locationName: course.location ?? undefined,
      capacity: course.capacity ?? 10,
      price,
      pricePerSession,
      packageOptions: course.packageOptions ?? undefined,
      description: course.description ?? undefined,
      schedule: course.scheduleSlots ?? [],
      clubId: (course as any).clubId ?? undefined,
      paymentRecipient: (course as any).paymentRecipient ?? 'COACH'
    };
  }

  onHeroPhotoSelected(event: Event): void {
    if (this.heroPhotoUploading()) {
      this.snackbar.open('O operațiune este deja în curs...', undefined, { duration: 3000 });
      return;
    }

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
    reader.onerror = () => {
      this.snackbar.open('Eroare la citirea fișierului', undefined, { duration: 4000 });
      this.heroPhotoUploading.set(false);
    };
    reader.onload = () => {
      const preview = reader.result as string;

      const courseId = this.courseId();
      if (!courseId) {
        // Just local preview if course not created yet (though usually we create it first)
        this.heroPhotoFile.set(file);
        this.heroPhotoPreview.set(preview);
        return;
      }

      this.heroPhotoUploading.set(true);
      // Optimistic preview update
      this.heroPhotoFile.set(file);
      this.heroPhotoPreview.set(preview);

      this.adminService
        .uploadCourseHeroPhoto(courseId, preview)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            const current = this.currentCourse();
            if (current) {
              this.currentCourse.set({ ...current, hasHeroPhoto: true });
            } else {
              this.currentCourse.set(updated);
            }
            this.heroPhotoFile.set(null);
            this.heroPhotoPreview.set(null);
            this.heroPhotoBust.set(Date.now());
            this.heroPhotoUploading.set(false);
            this.snackbar.open('Hero Photo a fost salvat', undefined, { duration: 3000 });
          },
          error: () => {
            this.heroPhotoUploading.set(false);
            this.heroPhotoFile.set(null); // Revert on error
            this.heroPhotoPreview.set(null);
            this.snackbar.open('Nu am putut salva Hero Photo', undefined, { duration: 4000 });
          }
        });
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  removeHeroPhoto(): void {
    if (this.heroPhotoUploading()) {
      return;
    }

    const courseId = this.courseId();
    if (courseId && this.currentCourse()?.hasHeroPhoto) {
      this.heroPhotoUploading.set(true);
      this.adminService
        .deleteCourseHeroPhoto(courseId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            const current = this.currentCourse();
            if (current) {
              this.currentCourse.set({ ...current, hasHeroPhoto: false });
            }
            this.heroPhotoFile.set(null);
            this.heroPhotoPreview.set(null);
            this.heroPhotoBust.set(Date.now());
            this.heroPhotoUploading.set(false);
            this.snackbar.open('Hero Photo a fost șters', undefined, { duration: 3000 });
          },
          error: () => {
            this.heroPhotoUploading.set(false);
            this.snackbar.open('Nu am putut șterge Hero Photo', undefined, { duration: 4000 });
          }
        });
      return;
    }

    this.heroPhotoFile.set(null);
    this.heroPhotoPreview.set(null);
  }

  getHeroPhotoUrl(): string | null {
    const courseId = this.courseId();
    const currentCourse = this.currentCourse();
    if (courseId && currentCourse?.hasHeroPhoto) {
      // Use the public endpoint with absolute base to avoid base-href/meta mismatches
      const base = this.apiBaseUrl.replace(/\/$/, '');
      const bust = this.heroPhotoBust();
      return `${base}/api/public/courses/${courseId}/hero-photo?v=${bust}`;
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
    reader.onerror = () => {
      this.snackbar.open('Eroare la citirea fișierului', undefined, { duration: 4000 });
    };
    reader.onload = () => {
      const preview = reader.result as string;
      const courseId = this.courseId();

      if (courseId) {
        this.isLoadingPhotos.set(true);
        this.adminService.uploadCoursePhoto(courseId, preview)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.open('Fotografia a fost salvată', undefined, { duration: 3000 });
              this.loadExistingPhotos(courseId);
            },
            error: () => {
              this.isLoadingPhotos.set(false);
              this.snackbar.open('Nu am putut salva fotografia', undefined, { duration: 4000 });
            }
          });
      } else {
        const currentPhotos = this.galleryPhotos();
        this.galleryPhotos.set([...currentPhotos, { preview, file }]);
      }
    };
    reader.readAsDataURL(file);

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

    this.adminService
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
    return this.adminService.getCoursePhotoUrl(courseId, photoId);
  }

  private loadExistingPhotos(courseId: string): void {
    this.isLoadingPhotos.set(true);
    this.adminService
      .getCoursePhotos(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          const sorted = (photos ?? []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          this.existingPhotos.set(sorted);
          this.isLoadingPhotos.set(false);
        },
        error: () => {
          this.existingPhotos.set([]);
          this.isLoadingPhotos.set(false);
        }
      });
  }

  // Gallery Drag & Drop Handlers

  movePhoto(index: number, direction: 'left' | 'right'): void {
    if (this.galleryBusy()) {
      return;
    }

    const items = [...this.existingPhotos()];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    // Swap items
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // Optimistically update local order
    const normalized = items.map((item, idx) => ({ ...item, displayOrder: idx }));
    this.existingPhotos.set(normalized);

    // Trigger save
    const courseId = this.courseId();
    if (courseId) {
      const photoIds = normalized.map((p) => p.id);
      this.reorderRequests.next({ courseId, photoIds });
    }
  }

  moveNewPhoto(index: number, direction: 'left' | 'right'): void {
    const items = [...this.galleryPhotos()];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    // Swap items
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    this.galleryPhotos.set(items);
  }

  trackByPhotoId(index: number, item: CoursePhotoItem): string {
    return item.id;
  }

  private uploadGalleryPhotos(courseId: string, photos: Array<{ preview: string; file: File }>): void {
    const totalPhotos = photos.length;

    from(photos)
      .pipe(
        // Upload sequentially to preserve order
        concatMap((photo) =>
          this.adminService.uploadCoursePhoto(courseId, photo.preview).pipe(
            map(() => ({ success: true })),
            catchError(() => of({ success: false }))
          )
        ),
        toArray(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (results) => {
          this.isSaving.set(false);
          const successCount = results.filter((r) => r.success).length;
          const failCount = totalPhotos - successCount;

          if (failCount === 0) {
            this.snackbar.open(
              `Cursul a fost ${this.courseId() ? 'actualizat' : 'creat'} și ${totalPhotos} ${totalPhotos === 1 ? 'fotografie a fost încărcată' : 'fotografii au fost încărcate'
              }`,
              undefined,
              { duration: 4000 }
            );
          } else if (successCount === 0) {
            this.snackbar.open('Cursul a fost salvat, dar nicio fotografie nu a putut fi încarcată.', undefined, {
              duration: 4000
            });
          } else {
            this.snackbar.open(
              `Cursul a fost salvat. ${successCount} foto încărcate, ${failCount} eșuate.`,
              undefined,
              { duration: 5000 }
            );
          }

          void this.router.navigate(['/admin/courses']);
        },
        error: () => {
          // This should technically not happen with the catchError above, but good as fallback
          this.isSaving.set(false);
          this.snackbar.open('Eroare neprevăzută la procesarea galeriei', undefined, { duration: 4000 });
          void this.router.navigate(['/admin/courses']);
        }
      });
  }

  // Build a non-null recurrenceRule string from the schedule similar to CoachService
  private buildRecurrenceRule(schedule?: CourseFormPayload['schedule']): string {
    const daySchedules: Record<string, { start: string; end?: string }> = {};
    const map: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 7
    };
    const slots = Array.isArray(schedule) ? schedule : [];
    slots.forEach((slot) => {
      if (!slot?.day || !slot?.startTime) return;
      const key = (map[String(slot.day).toLowerCase()] ?? 1).toString();
      daySchedules[key] = {
        start: this.normalizeTime(slot.startTime),
        end: slot.endTime ? this.normalizeTime(slot.endTime) : undefined
      };
    });
    try {
      return JSON.stringify({ daySchedules });
    } catch {
      return '';
    }
  }

  private normalizeTime(value?: string): string {
    if (!value) return '00:00';
    const parts = value.split(':');
    const hours = (parts[0] ?? '00').padStart(2, '0');
    const minutes = (parts[1] ?? '00').padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}



