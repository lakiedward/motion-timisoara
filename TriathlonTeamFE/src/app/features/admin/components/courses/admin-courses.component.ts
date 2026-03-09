import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService } from '../../services/admin.service';
import { AdminCourse } from '../../services/models/admin-course.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DeleteCourseDialogComponent, DeleteCourseDialogData, DeleteCourseDialogResult } from './delete-course-dialog.component';
import { SupabaseService } from '../../../../core/services/supabase.service';

@Component({
  selector: 'app-admin-courses',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './admin-courses.component.html',
  styleUrls: ['./admin-courses.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCoursesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<AdminCourse[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly updatingCourseId = signal<string | null>(null);
  readonly heroPhotoUrls = signal<Record<string, string>>({});
  readonly heroPhotoErrors = signal<Record<string, boolean>>({});

  ngOnInit(): void {
    this.loadCourses();
  }

  goToCreate(): void {
    void this.router.navigate(['/admin/courses', 'new']);
  }

  editCourse(course: AdminCourse): void {
    void this.router.navigate(['/admin/courses', course.id, 'edit']);
  }

  toggleStatus(course: AdminCourse): void {
    if (this.updatingCourseId()) {
      return;
    }
    const nextActive = !course.active;
    this.updatingCourseId.set(course.id);
    this.adminService
      .setCourseStatus(course.id, nextActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.courses.update((list) =>
            list.map((item) => (item.id === course.id ? { ...item, active: nextActive } : item))
          );
          this.updatingCourseId.set(null);
          this.snackbar.open(
            nextActive ? 'Cursul a fost activat' : 'Cursul a fost dezactivat',
            undefined,
            { duration: 3000 }
          );
        },
        error: () => {
          this.updatingCourseId.set(null);
          this.snackbar.open('Nu am putut actualiza statusul cursului', undefined, { duration: 4000 });
        }
      });
  }

  deleteCourse(course: AdminCourse): void {
    if (this.updatingCourseId()) {
      return;
    }

    this.openDeleteDialog(course, false);
  }

  private openDeleteDialog(course: AdminCourse, isForceDelete: boolean, activeEnrollmentsCount = 0): void {
    const dialogData: DeleteCourseDialogData = {
      courseName: course.name,
      activeEnrollmentsCount,
      isForceDelete
    };

    const dialogRef = this.dialog.open(DeleteCourseDialogComponent, {
      data: dialogData,
      panelClass: 'premium-dialog-panel',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: DeleteCourseDialogResult) => {
      if (result?.confirmed) {
        this.performDelete(course, result.force);
      }
    });
  }

  private performDelete(course: AdminCourse, force: boolean): void {
    this.updatingCourseId.set(course.id);
    this.adminService
      .deleteCourse(course.id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.courses.update((list) => list.filter((item) => item.id !== course.id));
          this.updatingCourseId.set(null);
          this.snackbar.open('Cursul a fost șters cu succes', undefined, { duration: 3000 });
        },
        error: (err) => {
          this.updatingCourseId.set(null);

          // Handle 409 Conflict (Active Enrollments) - show force delete dialog
          if (err.status === 409 && !force) {
            const enrollmentCount = this.extractEnrollmentCount(err.error?.message);
            this.openDeleteDialog(course, true, enrollmentCount);
            return;
          }

          const message = err?.error?.message || 'Nu am putut șterge cursul';
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  private extractEnrollmentCount(message: string | undefined): number {
    if (!message) return 1;
    const match = message.match(/(\d+)\s*inscrieri/);
    return match ? parseInt(match[1], 10) : 1;
  }

  trackByCourse(_: number, course: AdminCourse): string {
    return course.id;
  }

  getActiveCoursesCount(): number {
    return this.courses().filter(c => c.active).length;
  }

  getTotalEnrolled(): number {
    return this.courses().reduce((sum, c) => sum + (c.enrolledPaidCount || 0) + (c.enrolledUnpaidCount || 0), 0);
  }

  getHeroPhotoUrl(courseId: string): string {
    return this.heroPhotoUrls()[courseId] || '';
  }

  hasHeroPhotoError(courseId: string): boolean {
    return this.heroPhotoErrors()[courseId] || false;
  }

  loadHeroPhoto(courseId: string): void {
    // Use Supabase storage to get the hero photo URL
    const { data } = this.supabase.storage('course-photos').getPublicUrl(`${courseId}/hero`);
    const url = data?.publicUrl;
    if (url) {
      this.heroPhotoUrls.update(urls => ({
        ...urls,
        [courseId]: url
      }));
    } else {
      this.heroPhotoErrors.update(errors => ({ ...errors, [courseId]: true }));
    }
  }

  onHeroPhotoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  loadCourses(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.adminService
      .getAllCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (courses) => {
          this.courses.set(courses ?? []);
          this.isLoading.set(false);
          
          // Load hero photos for courses that have them
          courses?.forEach(course => {
            if (course.hasHeroPhoto) {
              this.loadHeroPhoto(course.id);
            }
          });
        },
        error: () => {
          this.courses.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
          this.snackbar.open('Nu am putut incarca lista de cursuri', undefined, { duration: 4000 });
        }
      });
  }
}
