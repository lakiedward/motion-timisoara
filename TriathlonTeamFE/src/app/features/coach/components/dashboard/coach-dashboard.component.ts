import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { JoinClubDialogComponent } from '../join-club-dialog/join-club-dialog.component';
import { CoachService, CoachCourseSummary } from '../../services/coach.service';
import { CoachApiService } from '../../services/coach-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StripeAccountStatus } from '../../../../core/models/auth';

export interface DashboardAlert {
  type: 'low-sessions' | 'no-attendance';
  message: string;
  icon: string;
  courseId?: string;
  courseName?: string;
}

export interface UpcomingSession {
  occurrenceId: string;
  courseId: string;
  courseName: string;
  date: string;
  time: string;
  location: string;
  enrolledCount: number;
}

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRippleModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './coach-dashboard.component.html',
  styleUrls: ['./coach-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachDashboardComponent implements OnInit {
  private readonly coachService = inject(CoachService);
  private readonly coachApiService = inject(CoachApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // State signals
  readonly courses = signal<CoachCourseSummary[]>([]);
  readonly upcomingSessions = signal<UpcomingSession[]>([]);
  readonly alerts = signal<DashboardAlert[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly stripeStatus = signal<StripeAccountStatus | null>(null);

  // Computed statistics
  readonly totalCourses = computed(() => this.courses().length);
  readonly activeCourses = computed(() =>
    this.courses().filter(c => c.active).length
  );
  readonly totalEnrolled = computed(() =>
    this.courses().reduce(
      (sum, c) => sum + (c.enrolledPaidCount || 0) + (c.enrolledUnpaidCount || 0),
      0
    )
  );
  readonly thisWeekSessions = computed(() => {
    const sessions = this.upcomingSessions();
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    return sessions.filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate >= now && sessionDate <= weekEnd;
    }).length;
  });
  readonly averageAttendance = computed(() => {
    // Placeholder - can be calculated from actual attendance data
    // For now, return a default value
    return 85;
  });

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadStripeStatus();
  }

  private loadStripeStatus(): void {
    this.authService.getStripeAccountStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status: StripeAccountStatus) => this.stripeStatus.set(status),
        error: () => this.stripeStatus.set(null)
      });
  }

  openStripeOnboarding(): void {
    this.authService.getStripeOnboardingLink()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (isPlatformBrowser(this.platformId)) {
            window.location.href = response.url;
          }
        },
        error: () => {
          this.snackbar.open('Eroare la deschiderea Stripe', undefined, { duration: 3000 });
        }
      });
  }

  navigateToAnnouncements(): void {
    void this.router.navigate(['/coach/announcements']);
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    // Load courses
    this.coachService
      .getMyCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (courses) => {
          this.courses.set(courses ?? []);
          this.calculateAlerts(courses ?? []);
          this.loadUpcomingSessions();
        },
        error: () => {
          this.courses.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
          this.snackbar.open('Nu am putut încărca datele dashboard-ului', undefined, { duration: 4000 });
        }
      });
  }

  private loadUpcomingSessions(): void {
    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekStartStr = this.formatDateForApi(weekStart);

    this.coachApiService
      .getWeeklyCalendar(weekStartStr)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (calendar) => {
          const sessions: UpcomingSession[] = [];

          // Extract sessions from calendar
          calendar.coaches?.forEach(coachWeek => {
            coachWeek.days?.forEach(day => {
              day.sessions?.forEach(session => {
                sessions.push({
                  occurrenceId: session.occurrenceId || '',
                  courseId: session.courseId || '',
                  courseName: session.courseName || '',
                  date: day.date || '',
                  time: `${session.startsAt || ''} - ${session.endsAt || ''}`,
                  location: '',
                  enrolledCount: session.enrolledCount || 0
                });
              });
            });
          });

          // Sort by date and take first 5
          const sortedSessions = sessions
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5);

          this.upcomingSessions.set(sortedSessions);
          this.isLoading.set(false);
        },
        error: () => {
          this.upcomingSessions.set([]);
          this.isLoading.set(false);
        }
      });
  }

  private calculateAlerts(courses: CoachCourseSummary[]): void {
    const alerts: DashboardAlert[] = [];

    // Alert: courses with low unpaid enrollments (can add sessions)
    courses.forEach(course => {
      if (course.enrolledUnpaidCount && course.enrolledUnpaidCount > 2) {
        alerts.push({
          type: 'low-sessions',
          message: `${course.name}: ${course.enrolledUnpaidCount} copii cu sesiuni scăzute`,
          icon: 'warning',
          courseId: course.id,
          courseName: course.name
        });
      }
    });

    this.alerts.set(alerts);
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    };
    return date.toLocaleDateString('ro-RO', options);
  }

  // Navigation methods
  navigateToNewCourse(): void {
    void this.router.navigate(['/coach/courses/new']);
  }

  navigateToAllCourses(): void {
    void this.router.navigate(['/coach/courses']);
  }

  navigateToAttendance(): void {
    void this.router.navigate(['/coach/attendance-payments']);
  }

  navigateToSessionAttendance(session: UpcomingSession): void {
    // Navigate to attendance page (could be enhanced to pre-select the session)
    void this.router.navigate(['/coach/attendance-payments']);
  }

  navigateToCourse(courseId: string): void {
    void this.router.navigate(['/coach/courses', courseId, 'edit']);
  }

  trackBySession(_: number, session: UpcomingSession): string {
    return session.occurrenceId || session.courseId + session.date;
  }

  trackByAlert(_: number, alert: DashboardAlert): string {
    return `${alert.type}-${alert.courseId || ''}`;
  }

  refresh(): void {
    this.loadDashboardData();
  }

  openJoinClubDialog(): void {
    const dialogRef = this.dialog.open(JoinClubDialogComponent, {
      width: '450px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Refresh data after joining a club
        this.loadDashboardData();
      }
    });
  }
}
