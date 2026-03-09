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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachService, CoachCourseSummary } from '../../services/coach.service';

@Component({
  selector: 'app-coach-courses',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './coach-courses.component.html',
  styleUrls: ['./coach-courses.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachCoursesComponent implements OnInit {
  private readonly coachService = inject(CoachService);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<CoachCourseSummary[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly updatingCourseId = signal<string | null>(null);
  readonly heroPhotoUrls = signal<Record<string, string>>({});
  readonly heroPhotoErrors = signal<Set<string>>(new Set());

  // Stats helpers
  getActiveCoursesCount(): number {
    return this.courses().filter(c => c.active).length;
  }

  getTotalEnrolled(): number {
    return this.courses().reduce((sum, c) => sum + (c.enrolledPaidCount || 0) + (c.enrolledUnpaidCount || 0), 0);
  }

  hasHeroPhotoError(courseId: string): boolean {
    return this.heroPhotoErrors().has(courseId);
  }

  ngOnInit(): void {
    this.loadCourses();
  }

  goToCreate(): void {
    void this.router.navigate(['/coach/courses', 'new']);
  }

  editCourse(course: CoachCourseSummary): void {
    void this.router.navigate(['/coach/courses', course.id, 'edit']);
  }

  openAnnouncements(course: CoachCourseSummary): void {
    void this.router.navigate(['/coach/courses', course.id, 'announcements']);
  }

  toggleStatus(course: CoachCourseSummary): void {
    if (this.updatingCourseId()) return;
    const nextActive = !course.active;
    this.updatingCourseId.set(course.id);
    this.coachService
      .setCourseStatus(course.id, Boolean(nextActive))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.courses.update((list) => list.map((c) => (c.id === course.id ? { ...c, active: nextActive } : c)));
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

  deleteCourse(course: CoachCourseSummary): void {
    if (this.updatingCourseId()) return;
    const confirmed = confirm(`Sigur vrei sa stergi cursul "${course.name}"? Aceasta actiune este permanenta.`);
    if (!confirmed) return;
    this.updatingCourseId.set(course.id);
    this.coachService
      .deleteCourse(course.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.courses.update((list) => list.filter((c) => c.id !== course.id));
          this.updatingCourseId.set(null);
          this.snackbar.open('Cursul a fost sters', undefined, { duration: 3000 });
        },
        error: (err) => {
          this.updatingCourseId.set(null);
          const message = err?.error?.message || 'Nu am putut sterge cursul';
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  trackByCourse(_: number, course: CoachCourseSummary): string {
    return course.id;
  }

  getHeroPhotoUrl(courseId: string): string {
    return this.heroPhotoUrls()[courseId] || '';
  }

  loadHeroPhoto(courseId: string): void {
    const url = `${this.apiBaseUrl}/api/public/courses/${courseId}/hero-photo`;
    
    this.http.get(url, {
      responseType: 'blob'
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (blob) => {
        const blobUrl = URL.createObjectURL(blob);
        this.heroPhotoUrls.update(urls => ({
          ...urls,
          [courseId]: blobUrl
        }));
      },
      error: (error) => {
        console.warn('Failed to load hero photo for course:', courseId, error);
        this.heroPhotoErrors.update(errors => new Set([...errors, courseId]));
      }
    });
  }

  onHeroPhotoError(event: Event, courseId: string): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    this.heroPhotoErrors.update(errors => new Set([...errors, courseId]));
  }

  loadCourses(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.coachService
      .getMyCourses()
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

