import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AdminService } from '../../services/admin.service';
import { CoursePhotoItem } from '../../services/models/admin-course.model';

@Component({
  selector: 'app-admin-course-photos',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, DragDropModule],
  templateUrl: './admin-course-photos.component.html',
  styleUrls: ['./admin-course-photos.component.scss']
})
export class AdminCoursePhotosComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly courseId = signal<string | null>(null);
  readonly photos = signal<CoursePhotoItem[]>([]);
  readonly isLoading = signal(true);
  readonly isUploading = signal(false);
  readonly loadError = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.courseId.set(id);
      if (id) {
        this.loadPhotos(id);
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

    // Upload photo
    const reader = new FileReader();
    reader.onload = () => {
      this.uploadPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input
    input.value = '';
  }

  deletePhoto(photoId: string): void {
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
          this.loadPhotos(courseId);
        },
        error: () => {
          this.snackbar.open('Nu am putut șterge fotografia', undefined, { duration: 4000 });
        }
      });
  }

  onDrop(event: CdkDragDrop<CoursePhotoItem[]>): void {
    const items = [...this.photos()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    // Update display order
    items.forEach((item, index) => {
      item.displayOrder = index;
    });

    this.photos.set(items);

    // Save new order
    const courseId = this.courseId();
    if (courseId) {
      const photoIds = items.map((p) => p.id);
      this.adminService
        .reorderCoursePhotos(courseId, photoIds)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackbar.open('Ordinea fotografiilor a fost actualizată', undefined, {
              duration: 3000
            });
          },
          error: () => {
            this.snackbar.open('Nu am putut actualiza ordinea', undefined, { duration: 4000 });
            this.loadPhotos(courseId);
          }
        });
    }
  }

  goBack(): void {
    void this.router.navigate(['/admin/courses']);
  }

  getPhotoUrl(photo: CoursePhotoItem): string {
    // If backend returned a presigned URL, use it directly
    if (photo.url) {
      return photo.url;
    }
    const courseId = this.courseId();
    if (!courseId) {
      return '';
    }
    return this.adminService.getCoursePhotoUrl(courseId, photo.id);
  }

  private loadPhotos(courseId: string): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.adminService
      .getCoursePhotos(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          this.photos.set(photos);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.isLoading.set(false);
        }
      });
  }

  private uploadPhoto(base64Photo: string): void {
    const courseId = this.courseId();
    if (!courseId) {
      return;
    }

    this.isUploading.set(true);

    this.adminService
      .uploadCoursePhoto(courseId, base64Photo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isUploading.set(false);
          this.snackbar.open('Fotografia a fost încărcată', undefined, { duration: 3000 });
          this.loadPhotos(courseId);
        },
        error: () => {
          this.isUploading.set(false);
          this.snackbar.open('Nu am putut încărca fotografia', undefined, { duration: 4000 });
        }
      });
  }
}

