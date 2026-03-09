import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClubService, ClubCourse, ClubCourseStats } from '../../services/club.service';
import { Router } from '@angular/router';
import {
  DeleteCourseDialogComponent,
  DeleteCourseDialogData,
  DeleteCourseDialogResult
} from '../../../admin/components/courses/delete-course-dialog.component';

@Component({
  selector: 'app-club-courses',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './club-courses.component.html',
  styleUrls: ['./club-courses.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubCoursesComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  private readonly clubService = inject(ClubService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<ClubCourse[]>([]);
  readonly stats = signal<ClubCourseStats>({ totalCourses: 0, activeCourses: 0, totalCapacity: 0 });
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly updatingCourseId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCourses();
    this.loadStats();
  }

  private loadCourses(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.clubService.getCourses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (courses) => {
        this.courses.set(courses);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading courses:', err);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.snackBar.open('Nu am putut încărca lista de cursuri', 'OK', { duration: 4000 });
      }
    });
  }

  private loadStats(): void {
    this.clubService.getCourseStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (stats) => this.stats.set(stats),
      error: (err) => console.error('Error loading course stats:', err)
    });
  }

  addCourse(): void {
    void this.router.navigate(['/club/courses/new']);
  }

  editCourse(course: ClubCourse): void {
    void this.router.navigate(['/club/courses', course.id, 'edit']);
  }

  toggleCourseStatus(course: ClubCourse): void {
    if (this.updatingCourseId()) return;

    const nextActive = !course.isActive;
    this.updatingCourseId.set(course.id);

    this.clubService.setCourseStatus(course.id, nextActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.courses.update((list) => list.map(c => c.id === course.id ? { ...c, isActive: nextActive } : c));
          this.updatingCourseId.set(null);
          this.snackBar.open(
            nextActive ? 'Curs activat cu succes' : 'Curs dezactivat cu succes',
            undefined, 
            { duration: 3000 }
          );
          this.loadStats();
        },
        error: (err) => {
          console.error('Error toggling course status:', err);
          this.updatingCourseId.set(null);
          this.snackBar.open('Nu am putut actualiza statusul cursului', undefined, { duration: 4000 });
        }
      });
  }

  getActiveCourses(): number {
    return this.stats().activeCourses;
  }

  getTotalCapacity(): number {
    return this.stats().totalCapacity;
  }

  formatPrice(price: number, currency: string): string {
    return `${(price / 100).toFixed(0)} ${currency}`;
  }

  formatAgeRange(course: ClubCourse): string {
    if (course.ageFrom && course.ageTo) {
      return `${course.ageFrom}-${course.ageTo} ani`;
    } else if (course.ageFrom) {
      return `${course.ageFrom}+ ani`;
    }
    return 'Toate vârstele';
  }

  deleteCourse(course: ClubCourse): void {
    if (this.updatingCourseId()) {
      return;
    }
    this.openDeleteDialog(course, false);
  }

  private openDeleteDialog(course: ClubCourse, isForceDelete: boolean, activeEnrollmentsCount = 0): void {
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

  private performDelete(course: ClubCourse, force: boolean): void {
    this.updatingCourseId.set(course.id);

    this.clubService
      .deleteCourse(course.id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.courses.update((list) => list.filter((item) => item.id !== course.id));
          this.updatingCourseId.set(null);
          this.snackBar.open('Cursul a fost șters cu succes', undefined, { duration: 3000 });
          this.loadStats();
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
          this.snackBar.open(message, undefined, { duration: 5000 });
        }
      });
  }

  private extractEnrollmentCount(message: string | undefined): number {
    if (!message) return 1;
    const match = message.match(/(\d+)\s*inscrieri/);
    return match ? parseInt(match[1], 10) : 1;
  }

  trackByCourse(_: number, course: ClubCourse): string {
    return course.id;
  }
}
