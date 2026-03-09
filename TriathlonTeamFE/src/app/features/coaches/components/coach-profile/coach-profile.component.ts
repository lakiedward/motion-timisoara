import { CommonModule, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';
import { AuthService } from '../../../../core/services/auth.service';
import { RatingService } from '../../../../core/services/rating.service';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';
import { RatingDialogComponent, RatingDialogData } from '../../../../shared/components/rating-dialog/rating-dialog.component';
import { CourseCardComponent } from '../../../program/course-card/course-card.component';
import {
  CoachCourseSummary,
  CoachDetail,
  CourseLevel,
  ProgramCourse,
  PublicApiService,
  PublicSport,
  SportType
} from '../../../../core/services/public-api.service';

@Component({
  selector: 'app-coach-profile',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, RouterLink, MatButtonModule, MatCardModule, MatIconModule, StarRatingComponent, CourseCardComponent],
  templateUrl: './coach-profile.component.html',
  styleUrls: ['./coach-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachProfileComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(PublicApiService);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly ratingService = inject(RatingService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private intersectionObserver?: IntersectionObserver;

  readonly coach = signal<CoachDetail | null>(null);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly myRating = signal<any | null>(null);
  readonly fullCourses = signal<ProgramCourse[]>([]);

  readonly courses = computed<ProgramCourse[]>(() => this.fullCourses());
  readonly biography = computed(() => this.coach()?.biography ?? '');

  readonly placeholderAvatar = 'https://placehold.co/480x480?text=Coach';
  scrollProgress = 0;
  readonly courseIdToHeroUrl = signal<Record<string, string>>({});

  getCoachPhotoUrl(coachId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachId}/photo`;
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            this.hasError.set(true);
            this.isLoading.set(false);
            return EMPTY;
          }

          this.isLoading.set(true);
          this.hasError.set(false);
          this.coach.set(null);
          return this.api.getCoach(id).pipe(
            finalize(() => {
              this.isLoading.set(false);
              // Refresh scroll reveal after content loads
              setTimeout(() => this.refreshScrollReveal(), 100);
            })
          );
        })
      )
      .subscribe({
        next: (coach) => {
          if (coach) {
            this.coach.set(coach);
            const courses = coach.courses ?? [];
            this.prefetchHeroPhotos(courses);
            this.loadMyRating();
            // Load full course details
            this.loadFullCourses(coach.id);
          }
        },
        error: () => {
          this.coach.set(null);
          this.hasError.set(true);
        }
      });
  }

  private loadFullCourses(coachId: string): void {
    // Load courses for this coach using the schedule endpoint
    this.api.getSchedule({ coachId })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of({ content: [], totalElements: 0, totalPages: 0 }))
      )
      .subscribe({
        next: (response) => {
          this.fullCourses.set(response.content);
        }
      });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.setupScrollReveal();

      // Re-observe elements after async content loads
      setTimeout(() => {
        this.refreshScrollReveal();
      }, 500);
    }
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  @HostListener('window:scroll')
  handleScroll(): void {
    if (!this.isBrowser) return;

    const scrollY = window.scrollY;
    const documentElement = document.documentElement;
    const maxScroll = documentElement.scrollHeight - window.innerHeight;

    if (maxScroll > 0) {
      this.scrollProgress = Math.min(100, Math.max(0, (scrollY / maxScroll) * 100));
    } else {
      this.scrollProgress = 0;
    }
  }

  trackByCourse = (_: number, course: ProgramCourse) => course.id;

  sportLabel(value?: PublicSport | SportType): string {
    // If it's a PublicSport object, return the name directly
    if (value && typeof value === 'object' && 'name' in value) {
      return value.name;
    }
    
    // Fallback for old string-based SportType
    const sportType = value as SportType | undefined;
    switch (sportType) {
      case 'inot':
        return 'Inot';
      case 'ciclism':
        return 'Ciclism';
      case 'alergare':
        return 'Alergare';
      case 'triatlon':
        return 'Triatlon';
      case 'fitness':
        return 'Fitness';
      default:
        return sportType ?? '';
    }
  }

  levelLabel(value?: CourseLevel): string {
    switch (value) {
      case 'incepator':
        return 'încep';
      case 'intermediar':
        return 'intermediar';
      case 'avansat':
        return 'avansat';
      default:
        return value ?? '';
    }
  }

  getSportIcon(sport?: PublicSport | SportType): string {
    if (sport && typeof sport === 'object' && 'name' in sport) {
      const code = sport.code?.toLowerCase() ?? '';
      return this.sportIcons[code] ?? '⚡';
    }
    
    const sportType = sport as SportType | undefined;
    return this.sportIcons[sportType?.toLowerCase() ?? ''] ?? '⚡';
  }

  getSportCode(sport?: PublicSport | SportType): string {
    if (sport && typeof sport === 'object' && 'code' in sport) {
      return sport.code?.toLowerCase() ?? 'general';
    }
    const sportType = sport as SportType | undefined;
    return sportType?.toLowerCase() ?? 'general';
  }

  navigateToCourse(courseId: string): void {
    this.router.navigate(['/cursuri', courseId]);
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

  heroBackgroundFor(courseId: string): string | null {
    const url = this.courseIdToHeroUrl()[courseId];
    return url ? `url('${url}')` : null;
  }

  private resolveUrl(possiblyRelative: string): string {
    if (!possiblyRelative) return '';
    if (/^https?:\/\//i.test(possiblyRelative)) return possiblyRelative;
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}${possiblyRelative.startsWith('/') ? '' : '/'}${possiblyRelative}`;
  }

  private prefetchHeroPhotos(courses: CoachCourseSummary[]): void {
    if (!courses?.length) return;
    courses.forEach((c) => {
      if (!c?.id) return;
      this.api
        .getCourse(c.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (detail) => {
            const url = detail?.heroPhotoUrl ? this.resolveUrl(detail.heroPhotoUrl) : '';
            if (!url) return;
            this.courseIdToHeroUrl.update((prev) => ({ ...prev, [c.id]: url }));
          },
          error: () => {
            // ignore individual fetch errors
          }
        });
    });
  }

  private readonly sportIcons: Record<string, string> = {
    'swim': '🏊',
    'inot': '🏊',
    'înot': '🏊',
    'bike': '🚴',
    'ciclism': '🚴',
    'run': '🏃',
    'alergare': '🏃',
    'camp': '⛺',
    'tabără': '⛺',
    'ski': '⛷️',
    'multisport': '🏆',
    'triatlon': '🏆',
    'fitness': '💪',
    'crossfit': '🏋️',
    'cross fit': '🏋️',
    'powerlifting': '🏋️',
    'power lifting': '🏋️',
    'general': '⚡'
  };

  private setupScrollReveal(): void {
    if (!this.isBrowser) return;

    const observerOptions: IntersectionObserverInit = {
      threshold: 0.05,
      rootMargin: '0px 0px -20px 0px'
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        el.classList.add('revealed');
      }

      this.intersectionObserver?.observe(el);
    });
  }

  private refreshScrollReveal(): void {
    if (!this.isBrowser || !this.intersectionObserver) return;

    const revealElements = document.querySelectorAll('.scroll-reveal:not(.revealed)');
    revealElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        el.classList.add('revealed');
      }

      this.intersectionObserver?.observe(el);
    });
  }

  loadMyRating(): void {
    const coach = this.coach();
    if (!coach || !this.authService.isLoggedIn() || this.authService.getCurrentUser()?.role !== 'PARENT') {
      return;
    }

    this.ratingService.getMyCoachRating(coach.id)
      .pipe(catchError(() => of(null)))
      .subscribe(rating => {
        this.myRating.set(rating);
      });
  }

  onRateCoach(): void {
    const coach = this.coach();
    if (!coach) {
      return;
    }

    if (!this.authService.isLoggedIn()) {
      void this.router.navigate(['/login'], {
        queryParams: { redirect: this.router.url }
      });
      return;
    }

    const dialogData: RatingDialogData = {
      entityType: 'coach',
      entityId: coach.id,
      entityName: coach.name,
      existingRating: this.myRating() || undefined
    };

    const dialogRef = this.dialog.open(RatingDialogComponent, {
      width: '500px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.myRating.set(result);
        // Refresh coach to get updated average rating
        this.api.getCoach(coach.id).subscribe(updatedCoach => {
          this.coach.set(updatedCoach);
        });
      }
    });
  }

  get canRate(): boolean {
    return this.authService.isLoggedIn() && this.authService.getCurrentUser()?.role === 'PARENT';
  }

  get ratingButtonText(): string {
    return this.myRating() ? 'Actualizează rating' : 'Evaluează antrenorul';
  }
}
