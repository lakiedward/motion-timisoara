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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { CoachSummary, ProgramCourse, PublicApiService, PublicClubDetail } from '../../../../core/services/public-api.service';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';
import { CourseCardComponent } from '../../../program/course-card/course-card.component';
import { getInitials } from '../../../../shared/utils/string-utils';

@Component({
  selector: 'app-club-details',
  standalone: true,
  imports: [CommonModule, RouterLink, CourseCardComponent],
  templateUrl: './club-details.component.html',
  styleUrls: ['./club-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubDetailsComponent implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  readonly club = signal<PublicClubDetail | null>(null);
  readonly coaches = signal<CoachSummary[]>([]);
  readonly fullCourses = signal<ProgramCourse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal(false);

  readonly heroPhotoUrl = computed(() => this.normalizeUrl(this.club()?.heroPhotoUrl));
  readonly logoUrl = computed(() => this.normalizeUrl(this.club()?.logoUrl));
  readonly courses = computed<ProgramCourse[]>(() => this.fullCourses());

  readonly isDescriptionExpanded = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = (params.get('id') ?? '').trim();
      if (!id) {
        this.club.set(null);
        this.isLoading.set(false);
        this.loadError.set(true);
        return;
      }
      this.loadClub(id);
    });
  }

  getInitials(name: string): string {
    return getInitials(name);
  }

  coachAvatarUrl(url: string | null | undefined): string | null {
    return this.normalizeUrl(url);
  }

  phoneHref(phone: string | null | undefined): string | null {
    const raw = String(phone ?? '').trim();
    if (!raw) return null;

    const normalized = raw.replace(/[^0-9+]/g, '');
    if (!normalized) return null;

    return `tel:${normalized}`;
  }

  emailHref(email: string | null | undefined): string | null {
    const raw = String(email ?? '').trim();
    if (!raw) return null;
    
    // Basic email validation regex
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(raw)) return null;

    return `mailto:${raw}`;
  }

  toggleDescription(): void {
    this.isDescriptionExpanded.update((v) => !v);
  }

  trackByCourse = (_: number, course: ProgramCourse) => course.id;

  navigateToCourse(courseId: string): void {
    void this.router.navigate(['/cursuri', courseId]);
  }

  enrollInCourse(courseId: string): void {
    if (this.authService.isLoggedIn()) {
      void this.router.navigate(['/account/checkout'], { queryParams: { kind: 'COURSE', id: courseId } });
      return;
    }
    void this.router.navigate(['/login'], {
      queryParams: { redirect: '/account/checkout', kind: 'COURSE', id: courseId }
    });
  }

  private loadClub(id: string): void {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(false);
    this.club.set(null);
    this.coaches.set([]);
    this.fullCourses.set([]);

    forkJoin({
      club: this.api.getPublicClub(id),
      coaches: this.api.getCoaches({ clubId: id }).pipe(catchError(() => of([]))),
      courses: this.api.getSchedule({ clubId: id }).pipe(
        catchError(() => of({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 0 }))
      )
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: ({ club, coaches, courses }) => {
          this.club.set(club ?? null);
          this.coaches.set(coaches ?? []);
          this.fullCourses.set(courses?.content ?? []);
        },
        error: () => {
          this.coaches.set([]);
          this.fullCourses.set([]);
          this.loadError.set(true);
        }
      });
  }

  private normalizeUrl(url: string | null | undefined): string | null {
    const raw = String(url ?? '').trim();
    if (!raw) return null;

    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
    if (hasScheme) return raw;

    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    if (base) {
      return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
    }

    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}


