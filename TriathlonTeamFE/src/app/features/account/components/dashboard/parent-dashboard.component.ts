import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { AccountService, ParentEnrollment, RecentPayment, CalendarEvent } from '../../services/account.service';
import { AnnouncementsService, AnnouncementDto } from '../../../../core/services/announcements.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ChildrenService, Child } from '../../services/children.service';
import { CalendarComponent } from '../calendar/calendar.component';

interface UpcomingActivity {
  id: string;
  title: string;
  childName?: string;
  scheduledAt?: string;
  period?: string;
  kind: 'course' | 'camp' | 'activity';
  location?: string;
  statusLabel: string;
}

interface DashboardLink {
  label: string;
  description: string;
  routerLink: string[];
  icon: string;
}

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatDividerModule,
    DatePipe,
    CalendarComponent
  ],
  templateUrl: './parent-dashboard.component.html',
  styleUrls: ['./parent-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParentDashboardComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly childrenService = inject(ChildrenService);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly parentName = signal<string>('');
  readonly userRole = signal<string>('');
  readonly isStaff = computed(() => ['COACH', 'ADMIN'].includes(this.userRole()));
  readonly children = signal<Child[]>([]);
  readonly enrollments = signal<ParentEnrollment[]>([]);
  readonly payments = signal<RecentPayment[]>([]);
  readonly calendarEvents = signal<CalendarEvent[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  readonly links: DashboardLink[] = [
    {
      label: 'Anunțuri',
      description: 'Mesaje de la antrenori',
      routerLink: ['/account/announcements'],
      icon: 'campaign'
    },
    {
      label: 'Profil copil',
      description: 'Adaugă sau editează informațiile copiilor tăi',
      routerLink: ['/account/children'],
      icon: 'family_restroom'
    },
    {
      label: 'Înscrieri & Plăți',
      description: 'Vezi statusul înscriierilor și istoricul plăților',
      routerLink: ['/account/enrollments'],
      icon: 'receipt_long'
    },
    {
      label: 'Prezențe',
      description: 'Urmărește participarea la cursuri și tabere',
      routerLink: ['/account/attendance'],
      icon: 'event_available'
    }
  ];

  readonly childNames = computed(() => this.children().map((child) => child.name));

  readonly outstandingPayments = computed(() =>
    this.payments().filter((payment) => payment.status === 'pending')
  );

  readonly pendingCashPayments = computed(() =>
    this.enrollments().filter((enrollment) => 
      enrollment.paymentStatus === 'pending' && enrollment.paymentMethod === 'CASH'
    )
  );

  readonly activeEnrollments = computed(() =>
    this.enrollments().filter((enrollment) => enrollment.status === 'active').length
  );

  readonly activeCoursesWithSessions = computed(() =>
    this.enrollments().filter((enrollment) => 
      enrollment.kind === 'course' && 
      enrollment.status === 'active' &&
      (enrollment.remainingSessions != null || enrollment.purchasedSessions != null)
    )
  );

  readonly hasActiveCourses = computed(() => this.activeCoursesWithSessions().length > 0);

  readonly upcomingEventsCount = computed(() => {
    const today = new Date();
    return this.calendarEvents().filter((event) => event.date >= today).length;
  });

  readonly hasNewAnnouncements = signal(false);
  readonly recentAnnouncements = signal<AnnouncementDto[]>([]);

  readonly upcomingActivities = computed<UpcomingActivity[]>(() => {
    return this.enrollments()
      .filter((enrollment) => enrollment.status !== 'completed')
      .map((enrollment) => {
        const next = enrollment.nextOccurrence ? new Date(enrollment.nextOccurrence) : null;
        const hasValidDate = next && !Number.isNaN(next.getTime());
        return {
          id: enrollment.id,
          title: enrollment.title,
          childName: enrollment.childName,
          scheduledAt: hasValidDate ? next!.toISOString() : undefined,
          period: enrollment.period,
          kind: enrollment.kind ?? 'course',
          location: enrollment.location,
          statusLabel: enrollment.statusLabel
        };
      })
      .sort((a, b) => {
        const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
        const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
        return dateA - dateB;
      })
      .slice(0, 6);
  });

  ngOnInit(): void {
    // Get current user info
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (user?.name) {
          this.parentName.set(user.name);
        }
        if (user?.role) {
          this.userRole.set(user.role);
        }
      });

    // Only load parent-specific data if not staff
    const currentUser = this.authService.getCurrentUser();
    const isStaffUser = currentUser?.role === 'COACH' || currentUser?.role === 'ADMIN';

    if (isStaffUser) {
      // Staff don't need parent data - just show profile page
      this.isLoading.set(false);
      return;
    }

    // Load children (only for parents)
    this.childrenService.children$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((children) => this.children.set(children));

    this.childrenService.loadChildren().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    // ✅ Load parent overview (no delay needed - WebSocket ensures data is ready)
    this.accountService
      .getParentOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ enrollments, payments }) => {
          this.enrollments.set(enrollments);
          this.payments.set(payments);
          this.isLoading.set(false);
          this.hasError.set(false);
        },
        error: () => {
          this.enrollments.set([]);
          this.payments.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });

    // Load calendar events for the next 60 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 60);

    this.accountService
      .getCalendarEvents(startDate, endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (events) => {
          this.calendarEvents.set(events);
        },
        error: () => {
          this.calendarEvents.set([]);
        }
      });

    // Load recent announcements to show "Nou" badge (7 zile)
    if (this.authService.isLoggedIn() && this.authService.getCurrentUser()?.role === 'PARENT') {
      this.announcementsService
        .listParentFeed({ limit: 20 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (items: AnnouncementDto[]) => {
            this.recentAnnouncements.set(items ?? []);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const hasRecent = items.some((a) => new Date(a.createdAt).getTime() >= now - sevenDays);
            this.hasNewAnnouncements.set(hasRecent);
          },
          error: () => this.hasNewAnnouncements.set(false)
        });
    }
  }

  trackByActivity(_: number, activity: UpcomingActivity): string {
    return activity.id;
  }

  trackByEnrollment(_: number, enrollment: ParentEnrollment): string {
    return enrollment.id;
  }

  trackByPayment(_: number, payment: RecentPayment): string {
    return payment.id;
  }

  trackByAnnouncement(_: number, a: AnnouncementDto): string {
    return a.id;
  }

  openAnnouncementsFor(a: AnnouncementDto): void {
    const courseId = a.courseId;
    if (courseId) {
      void this.router.navigate(['/account/announcements'], { queryParams: { courseId } });
    } else {
      void this.router.navigate(['/account/announcements']);
    }
  }

  navigateToChild(id: string): void {
    void this.router.navigate(['/account/child', id]);
  }

  addChild(): void {
    void this.router.navigate(['/account/child', 'new']);
  }

  isLowSessions(enrollment: ParentEnrollment): boolean {
    const remaining = enrollment.remainingSessions ?? 0;
    const purchased = enrollment.purchasedSessions ?? 0;
    return purchased > 0 && remaining <= 3;
  }
}
