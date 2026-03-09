import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CourseFormComponent } from '../../../coach/components/course-form/course-form.component';
import { CourseFormPayload } from '../../../coach/services/coach.service';
import { CourseScheduleSlot } from '../../../coach/services/coach-api.service';
import { ClubCoach, ClubCourseDetail, ClubService, CoursePhotoItem, CreateClubCourseRequest, UpdateClubCourseRequest } from '../../services/club.service';
import { SupabaseService } from '../../../../core/services/supabase.service';

@Component({
  selector: 'app-club-course-form',
  standalone: true,
  imports: [CommonModule, CourseFormComponent, MatSelectModule, MatButtonModule, MatIconModule, MatSnackBarModule, DragDropModule],
  templateUrl: './club-course-form.component.html',
  styleUrls: ['./club-course-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubCourseFormComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly supabase = inject(SupabaseService);

  readonly coaches = signal<ClubCoach[]>([]);
  readonly selectedCoachUserId = signal<string | null>(null);
  readonly paymentRecipient = signal<'COACH' | 'CLUB'>('CLUB');

  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly isSaving = signal(false);

  readonly courseId = signal<string | null>(null);
  readonly courseLoading = signal(false);
  readonly courseLoadError = signal(false);
  readonly externalCourse = signal<CourseFormPayload | null>(null);
  readonly existingActive = signal(true);
  readonly currentCourse = signal<ClubCourseDetail | null>(null);

  readonly heroPhotoPreview = signal<string | null>(null);
  readonly heroPhotoFile = signal<File | null>(null);

  readonly galleryPhotos = signal<CoursePhotoItem[]>([]);
  readonly galleryLoading = signal(false);
  readonly galleryLoadError = signal(false);
  readonly galleryUploading = signal(false);
  readonly galleryReordering = signal(false);
  readonly galleryUploadTotal = signal(0);
  readonly galleryUploadDone = signal(0);

  // New signals for manual ordering
  readonly galleryOrderDirty = signal(false);
  readonly galleryInitialOrderIds = signal<string[]>([]);

  readonly pendingGallery = signal<PendingGalleryPhoto[]>([]);

  readonly isEditMode = computed(() => Boolean(this.courseId()));

  readonly galleryBusy = computed(() => {
    return this.isSaving() || this.galleryLoading() || this.galleryUploading() || this.galleryReordering();
  });

  readonly galleryUploadProgressLabel = computed(() => {
    const total = this.galleryUploadTotal();
    if (!total) return null;
    const done = this.galleryUploadDone();
    return `${done}/${total}`;
  });

  readonly selectedCoach = computed(() => {
    const id = this.selectedCoachUserId();
    if (!id) return null;
    return this.coaches().find((c) => c.userId === id) ?? null;
  });

  readonly selectedCoachCanReceivePayments = computed(() => {
    const coach = this.selectedCoach();
    if (!coach) return false;
    // Backwards-compatible: if backend doesn't send canReceivePayments yet, fall back to stripeOnboardingComplete.
    return coach.canReceivePayments ?? coach.stripeOnboardingComplete;
  });

  ngOnInit(): void {
    this.loadCoaches();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idFromRoute = params.get('id');
      this.courseId.set(idFromRoute);

      if (idFromRoute) {
        this.heroPhotoPreview.set(null);
        this.heroPhotoFile.set(null);
        this.currentCourse.set(null);
        this.pendingGallery.set([]);
        this.galleryPhotos.set([]);
        this.galleryLoadError.set(false);
        this.galleryLoading.set(false);
        this.galleryUploading.set(false);
        this.galleryReordering.set(false);
        this.galleryUploadTotal.set(0);
        this.galleryUploadDone.set(0);
        this.galleryOrderDirty.set(false);
        this.galleryInitialOrderIds.set([]);
        this.loadCourseForEdit(idFromRoute);
        this.loadGalleryPhotos(idFromRoute);
      } else {
        this.courseLoading.set(false);
        this.courseLoadError.set(false);
        this.externalCourse.set(null);
        this.existingActive.set(true);
        this.currentCourse.set(null);
        this.heroPhotoPreview.set(null);
        this.heroPhotoFile.set(null);
        this.selectedCoachUserId.set(null);
        this.paymentRecipient.set('CLUB');
        this.pendingGallery.set([]);
        this.galleryPhotos.set([]);
        this.galleryLoadError.set(false);
        this.galleryLoading.set(false);
        this.galleryUploading.set(false);
        this.galleryReordering.set(false);
        this.galleryUploadTotal.set(0);
        this.galleryUploadDone.set(0);
        this.galleryOrderDirty.set(false);
        this.galleryInitialOrderIds.set([]);
      }
    });
  }

  onHeroPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Format permis: JPEG, PNG, GIF, WEBP', undefined, {
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

    this.heroPhotoFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.heroPhotoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  removeHeroPhoto(): void {
    this.heroPhotoFile.set(null);
    this.heroPhotoPreview.set(null);
  }

  onGalleryFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    // Reset input so selecting the same file again triggers change
    input.value = '';

    if (this.galleryOrderDirty()) {
      this.snackbar.open('Salvează sau renunță la ordinea nesalvată înainte să încarci poze.', undefined, {
        duration: 5000
      });
      return;
    }

    const validFiles = files.filter((file) => this.isValidImageFile(file));
    if (validFiles.length === 0) {
      return;
    }

    if (this.isEditMode()) {
      const courseId = this.courseId();
      if (!courseId) return;
      void this.uploadGalleryFiles(courseId, validFiles);
      return;
    }

    void this.addPendingGalleryFiles(validFiles);
  }

  removePendingGalleryPhoto(localId: string): void {
    const next = this.pendingGallery().filter((p) => p.localId !== localId);
    this.pendingGallery.set(next);
  }

  onPendingGalleryDrop(event: CdkDragDrop<PendingGalleryPhoto[]>): void {
    const items = [...this.pendingGallery()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.pendingGallery.set(items);
  }

  onGalleryDrop(event: CdkDragDrop<CoursePhotoItem[]>): void {
    if (this.galleryBusy()) {
      return;
    }
    const courseId = this.courseId();
    if (!courseId) {
      return;
    }

    const items = [...this.galleryPhotos()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    // Optimistically update local order.
    // We don't save to backend yet. We just mark as dirty.
    const normalized = items.map((item, index) => ({ ...item, displayOrder: index }));
    this.galleryPhotos.set(normalized);
    this.galleryOrderDirty.set(true);
  }

  saveGalleryOrder(): void {
    if (this.galleryBusy() || !this.galleryOrderDirty()) {
      return;
    }
    const courseId = this.courseId();
    if (!courseId) return;

    this.galleryReordering.set(true);
    const photos = this.galleryPhotos();
    const photoIds = photos.map((p) => p.id);
    if (photoIds.length === 0) {
      this.galleryReordering.set(false);
      this.snackbar.open('Nu există fotografii de salvat.', undefined, { duration: 3000 });
      return;
    }

    this.clubService
      .reorderCoursePhotos(courseId, photoIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.galleryReordering.set(false);
          this.galleryOrderDirty.set(false);
          this.galleryInitialOrderIds.set(photoIds);
          this.snackbar.open('Ordinea a fost salvată', undefined, { duration: 3000 });
        },
        error: (err) => {
          this.galleryReordering.set(false);
          // Helpful debug context (check DevTools console + Network tab)
          console.error('Error saving gallery order', { courseId, photoIds, err });
          const message = this.getFriendlyHttpErrorMessage(err, 'Nu am putut salva ordinea');
          this.snackbar.open(message, undefined, { duration: 6000 });
        }
      });
  }

  cancelGalleryOrderChanges(): void {
    if (this.galleryBusy()) return;
    
    // Restore initial order by re-sorting or reloading.
    // Since we have the full objects, we can just re-sort them based on initial IDs.
    const initialIds = this.galleryInitialOrderIds();
    const currentPhotos = this.galleryPhotos();
    
    if (initialIds.length === 0) {
      // Fallback: reload from server if we somehow lost state
      const courseId = this.courseId();
      if (courseId) this.loadGalleryPhotos(courseId);
      return;
    }

    const photosMap = new Map(currentPhotos.map(p => [p.id, p]));
    const restored: CoursePhotoItem[] = [];
    
    initialIds.forEach((id, index) => {
      const p = photosMap.get(id);
      if (p) {
        restored.push({ ...p, displayOrder: index });
        photosMap.delete(id);
      }
    });

    // If there are any leftovers (e.g. somehow added in meantime?), append them
    // But in this flow we don't add new photos while reordering usually.
    // Just in case:
    photosMap.forEach(p => restored.push(p));

    this.galleryPhotos.set(restored);
    this.galleryOrderDirty.set(false);
    this.snackbar.open('Modificările de ordine au fost anulate', undefined, { duration: 2000 });
  }

  deleteGalleryPhoto(photoId: string): void {
    const courseId = this.courseId();
    if (!courseId || this.galleryBusy()) {
      return;
    }

    if (!confirm('Ești sigur că vrei să ștergi această fotografie?')) {
      return;
    }

    this.galleryUploading.set(true);
    this.clubService
      .deleteCoursePhoto(courseId, photoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.galleryUploading.set(false);
          this.snackbar.open('Fotografia a fost ștearsă', undefined, { duration: 3000 });
          this.loadGalleryPhotos(courseId);
        },
        error: () => {
          this.galleryUploading.set(false);
          this.snackbar.open('Nu am putut șterge fotografia', undefined, { duration: 4000 });
        }
      });
  }

  getGalleryPhotoUrl(photoId: string): string {
    const courseId = this.courseId();
    if (!courseId) return '';
    const { data } = this.supabase.storage('course-photos').getPublicUrl(`${courseId}/${photoId}`);
    return data?.publicUrl ?? '';
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

  onCancel(): void {
    void this.router.navigate(['/club/courses']);
  }

  onCoachChange(coachUserId: string): void {
    this.selectedCoachUserId.set(coachUserId);

    // If the currently selected recipient is COACH but this coach cannot receive payments,
    // force it back to CLUB to avoid invalid configuration.
    if (this.paymentRecipient() === 'COACH' && !this.selectedCoachCanReceivePayments()) {
      this.paymentRecipient.set('CLUB');
      this.snackbar.open('Antrenorul selectat nu are Stripe activ. Plățile nu pot merge către antrenor.', undefined, {
        duration: 5000
      });
    }
  }

  onPaymentRecipientChange(value: 'COACH' | 'CLUB'): void {
    if (value === 'COACH' && !this.selectedCoachCanReceivePayments()) {
      this.paymentRecipient.set('CLUB');
      this.snackbar.open('Antrenorul selectat nu are Stripe activ. Alege "Club" sau configurează Stripe.', undefined, {
        duration: 6000
      });
      return;
    }

    this.paymentRecipient.set(value);
  }

  onSubmit(payload: CourseFormPayload): void {
    if (this.isSaving()) {
      return;
    }

    const coachId = this.selectedCoachUserId();
    if (!coachId) {
      this.snackbar.open('Selectează un antrenor înainte de a salva cursul.', undefined, { duration: 4000 });
      return;
    }

    if (this.paymentRecipient() === 'COACH' && !this.selectedCoachCanReceivePayments()) {
      this.snackbar.open('Nu poți seta încasările pe antrenor: Stripe nu este activ pentru antrenorul selectat.', undefined, {
        duration: 6000
      });
      return;
    }

    const locationId = (payload.locationId ?? '').toString().trim();
    if (!locationId) {
      this.snackbar.open('Selectează o locație pentru curs.', undefined, { duration: 4000 });
      return;
    }

    this.isSaving.set(true);

    const recurrenceRule = this.buildRecurrenceRule(payload.schedule);

    const isEdit = this.isEditMode();
    const courseId = this.courseId();

    const baseRequest = {
      coachId,
      name: payload.name,
      sport: payload.sport,
      level: payload.level || null,
      ageFrom: payload.ageFrom ?? null,
      ageTo: payload.ageTo ?? null,
      locationId,
      capacity: payload.capacity ?? null,
      price: payload.price,
      pricePerSession: payload.pricePerSession,
      packageOptions: payload.packageOptions ?? null,
      recurrenceRule,
      description: payload.description ?? null,
      heroPhoto: this.heroPhotoPreview() || undefined,
      paymentRecipient: this.paymentRecipient()
    };

    const save$ = isEdit && courseId
      ? this.clubService.updateCourse(courseId, {
          ...(baseRequest as Omit<UpdateClubCourseRequest, 'active'>),
          active: this.existingActive()
        })
      : this.clubService.createCourse({
          ...(baseRequest as CreateClubCourseRequest),
          active: true
        });

    save$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: any) => {
        if (isEdit) {
          this.isSaving.set(false);
          this.snackbar.open('Cursul a fost actualizat', undefined, { duration: 4000 });
          void this.router.navigate(['/club/courses']);
          return;
        }

        // Create flow: optionally upload queued gallery photos after course is created.
        const createdCourseId = String(response?.id ?? '').trim();
        const pending = this.pendingGallery();

        if (pending.length > 0 && createdCourseId) {
          this.snackbar.open('Cursul a fost creat. Se încarcă pozele din galerie...', undefined, { duration: 5000 });
          void this.uploadPendingGalleryAfterCreate(createdCourseId);
          return;
        }

        this.isSaving.set(false);
        this.snackbar.open('Cursul a fost creat', undefined, { duration: 4000 });
        void this.router.navigate(['/club/courses']);
      },
      error: (err) => {
        this.isSaving.set(false);
        const message = err?.error?.message || (isEdit ? 'Nu am putut actualiza cursul' : 'Nu am putut crea cursul');
        this.snackbar.open(message, undefined, { duration: 6000 });
      }
    });
  }

  private loadCoaches(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.clubService
      .getCoaches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coaches) => {
          this.coaches.set(coaches ?? []);
          this.isLoading.set(false);
          this.ensureValidPaymentRecipient();
        },
        error: () => {
          this.coaches.set([]);
          this.isLoading.set(false);
          this.loadError.set(true);
        }
      });
  }

  private loadCourseForEdit(courseId: string): void {
    this.courseLoading.set(true);
    this.courseLoadError.set(false);

    this.clubService
      .getCourseById(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (course: ClubCourseDetail) => {
          this.courseLoading.set(false);
          this.courseLoadError.set(false);

          this.currentCourse.set(course);

          this.selectedCoachUserId.set(course.coachId);
          this.existingActive.set(Boolean(course.active));
          this.paymentRecipient.set(this.normalizePaymentRecipient(course.paymentRecipient));

          const scheduleSlots: CourseScheduleSlot[] = (course.scheduleSlots ?? []).map((slot) => ({
            day: slot.day,
            dayLabel: slot.dayLabel,
            startTime: slot.startTime,
            endTime: slot.endTime
          }));

          this.externalCourse.set({
            name: course.name,
            sport: course.sport,
            level: (course.level ?? '') as string,
            ageFrom: (course.ageFrom ?? 8) as number,
            ageTo: (course.ageTo ?? 12) as number,
            locationId: course.locationId,
            capacity: (course.capacity ?? 10) as number,
            price: course.price,
            pricePerSession: course.pricePerSession,
            packageOptions: course.packageOptions ?? undefined,
            schedule: scheduleSlots,
            description: course.description ?? undefined,
            clubId: course.clubId ?? undefined,
            paymentRecipient: this.normalizePaymentRecipient(course.paymentRecipient)
          });

          this.ensureValidPaymentRecipient();
        },
        error: (err) => {
          console.error('Error loading course details:', err);
          this.courseLoading.set(false);
          this.courseLoadError.set(true);
          this.snackbar.open('Nu am putut încărca cursul pentru editare', undefined, { duration: 6000 });
        }
      });
  }

  private loadGalleryPhotos(courseId: string): void {
    this.galleryLoading.set(true);
    this.galleryLoadError.set(false);

    this.clubService
      .getCoursePhotos(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          const sorted = (photos ?? []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          this.galleryPhotos.set(sorted);
          this.galleryInitialOrderIds.set(sorted.map(p => p.id));
          this.galleryOrderDirty.set(false);
          this.galleryLoading.set(false);
        },
        error: () => {
          this.galleryPhotos.set([]);
          this.galleryLoading.set(false);
          this.galleryLoadError.set(true);
        }
      });
  }

  trackByPhotoId(index: number, item: CoursePhotoItem): string {
    return item.id;
  }

  trackByPendingId(index: number, item: PendingGalleryPhoto): string {
    return item.localId;
  }

  private extractErrorMessage(err: any): string | null {
    const payload = err?.error;
    if (!payload) return null;
    if (typeof payload === 'string') return payload.trim() || null;

    const message = payload?.message ?? payload?.error?.message;
    if (typeof message === 'string') {
      const trimmed = message.trim();
      return trimmed.length ? trimmed : null;
    }

    return null;
  }

  private getFriendlyHttpErrorMessage(err: any, fallback: string): string {
    const status = err?.status;
    const serverMessage = this.extractErrorMessage(err);
    if (serverMessage) return serverMessage;

    if (status === 0) return 'Nu pot contacta serverul (network/CORS).';
    if (status === 401) return 'Sesiunea a expirat. Te rog autentifică-te din nou.';
    if (status === 403) return 'Nu ai permisiuni pentru această acțiune.';
    if (status === 404) return 'Cursul nu a fost găsit (sau nu ai acces).';
    if (status === 400) return 'Cerere invalidă. Reîncarcă pagina și încearcă din nou.';

    return fallback;
  }

  private ensureValidPaymentRecipient(): void {
    // Only enforce once we have coaches loaded + a selection.
    if (this.isLoading()) {
      return;
    }
    if (this.paymentRecipient() !== 'COACH') {
      return;
    }
    if (!this.selectedCoachCanReceivePayments()) {
      this.paymentRecipient.set('CLUB');
      this.snackbar.open('Antrenorul selectat nu are Stripe activ. Plățile nu pot merge către antrenor.', undefined, {
        duration: 5000
      });
    }
  }

  private normalizePaymentRecipient(value: unknown): 'COACH' | 'CLUB' {
    const normalized = String(value ?? '').trim().toUpperCase();
    return normalized === 'COACH' ? 'COACH' : 'CLUB';
  }

  private buildRecurrenceRule(schedule: CourseScheduleSlot[]): string {
    const dayMap: Record<string, number> = {
      monday: 1,
      MONDAY: 1,
      tuesday: 2,
      TUESDAY: 2,
      wednesday: 3,
      WEDNESDAY: 3,
      thursday: 4,
      THURSDAY: 4,
      friday: 5,
      FRIDAY: 5,
      saturday: 6,
      SATURDAY: 6,
      sunday: 7,
      SUNDAY: 7
    };

    const daySchedules: Record<string, { start: string; end: string }> = {};

    (schedule ?? []).forEach((slot) => {
      if (!slot?.startTime || !slot?.endTime) return;
      const dayNumber = dayMap[String(slot.day)];
      if (!dayNumber) return;
      daySchedules[dayNumber.toString()] = {
        start: slot.startTime,
        end: slot.endTime
      };
    });

    return JSON.stringify({ daySchedules });
  }

  private isValidImageFile(file: File): boolean {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Format permis: JPEG, PNG, GIF, WEBP', undefined, {
        duration: 4000
      });
      return false;
    }

    if (file.size > maxSize) {
      this.snackbar.open('Imaginea este prea mare. Dimensiunea maximă: 10MB', undefined, {
        duration: 4000
      });
      return false;
    }

    return true;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private makeLocalId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private async addPendingGalleryFiles(files: File[]): Promise<void> {
    if (this.galleryBusy()) {
      return;
    }

    const next: PendingGalleryPhoto[] = [];

    for (const file of files) {
      try {
        const dataUrl = await this.readFileAsDataUrl(file);
        next.push({
          localId: this.makeLocalId('gallery'),
          dataUrl,
          fileName: file.name
        });
      } catch (err) {
        console.error('Error reading file:', err);
        this.snackbar.open('Nu am putut citi fișierul selectat', undefined, { duration: 4000 });
      }
    }

    if (next.length > 0) {
      this.pendingGallery.set([...this.pendingGallery(), ...next]);
    }
  }

  private async uploadGalleryFiles(courseId: string, files: File[]): Promise<void> {
    if (this.galleryBusy()) {
      return;
    }

    if (this.galleryOrderDirty()) {
      this.snackbar.open('Salvează sau renunță la ordinea nesalvată înainte să încarci poze.', undefined, {
        duration: 5000
      });
      return;
    }

    this.galleryUploading.set(true);
    this.galleryUploadTotal.set(files.length);
    this.galleryUploadDone.set(0);

    try {
      for (const file of files) {
        const dataUrl = await this.readFileAsDataUrl(file);
        await firstValueFrom(this.clubService.uploadCoursePhoto(courseId, dataUrl));
        this.galleryUploadDone.update((v) => v + 1);
      }

      this.snackbar.open('Fotografiile au fost încărcate', undefined, { duration: 3000 });
      this.loadGalleryPhotos(courseId);
    } catch (err) {
      console.error('Error uploading gallery photos:', err);
      this.snackbar.open('Nu am putut încărca toate fotografiile', undefined, { duration: 5000 });
      this.loadGalleryPhotos(courseId);
    } finally {
      this.galleryUploading.set(false);
      this.galleryUploadTotal.set(0);
      this.galleryUploadDone.set(0);
    }
  }

  private async uploadPendingGalleryAfterCreate(createdCourseId: string): Promise<void> {
    const pending = this.pendingGallery();
    if (pending.length === 0) {
      this.isSaving.set(false);
      this.snackbar.open('Cursul a fost creat', undefined, { duration: 4000 });
      void this.router.navigate(['/club/courses']);
      return;
    }

    this.galleryUploading.set(true);
    this.galleryUploadTotal.set(pending.length);
    this.galleryUploadDone.set(0);

    try {
      for (const item of pending) {
        await firstValueFrom(this.clubService.uploadCoursePhoto(createdCourseId, item.dataUrl));
        this.galleryUploadDone.update((v) => v + 1);
      }

      this.snackbar.open('Pozele au fost încărcate în galerie', undefined, { duration: 4000 });
    } catch (err) {
      console.error('Error uploading pending gallery photos:', err);
      this.snackbar.open('Cursul a fost creat, dar nu am putut încărca toate pozele', undefined, {
        duration: 6000
      });
    } finally {
      this.galleryUploading.set(false);
      this.galleryUploadTotal.set(0);
      this.galleryUploadDone.set(0);
      this.pendingGallery.set([]);
      this.isSaving.set(false);
      void this.router.navigate(['/club/courses']);
    }
  }
}

interface PendingGalleryPhoto {
  localId: string;
  dataUrl: string;
  fileName: string;
}


