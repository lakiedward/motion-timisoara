import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { CourseDetail, PublicApiService } from '../../../core/services/public-api.service';
import { RatingService } from '../../../core/services/rating.service';
import { API_BASE_URL } from '../../../core/tokens/api-base-url.token';
import { WeekCalendarComponent } from './week-calendar/week-calendar.component';
import { CourseGalleryComponent } from './course-gallery/course-gallery.component';
import { LocationMapComponent } from './location-map/location-map.component';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';
import { RatingDialogComponent, RatingDialogData } from '../../../shared/components/rating-dialog/rating-dialog.component';
import { CourseAnnouncementsComponent } from './course-announcements/course-announcements.component';

interface EnrichedCourseDetail extends CourseDetail {
  capacity?: number;
  spotsLeft?: number;
  availableSpots?: number;
  groupSize?: number;
  spotsAvailable?: number;
  remainingSpots?: number;
  maxCapacity?: number;
  openSpots?: number;
}

@Component({
  selector: 'app-course-details',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    MatButtonModule, 
    MatIconModule,
    WeekCalendarComponent,
    CourseGalleryComponent,
    LocationMapComponent,
    StarRatingComponent,
    CourseAnnouncementsComponent
  ],
  templateUrl: './course-details.component.html',
  styleUrls: ['./course-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PublicApiService);
  private readonly authService = inject(AuthService);
  private readonly ratingService = inject(RatingService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiBaseUrl = inject<string>(API_BASE_URL);

  readonly course = signal<EnrichedCourseDetail | null>(null);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly myRating = signal<any | null>(null);

  // Resolved hero photo URL
  readonly resolvedHeroPhotoUrl = computed(() => {
    const course = this.course();
    if (!course?.heroPhotoUrl) return null;
    return this.resolveUrl(course.heroPhotoUrl);
  });

  // Resolved coach avatar URL
  readonly resolvedCoachAvatarUrl = computed(() => {
    const course = this.course();
    if (!course?.coach?.avatarUrl) return null;
    return this.resolveUrl(course.coach.avatarUrl);
  });

  readonly capacityInfo = computed(() => {
    const course = this.course();
    if (!course) {
      return null;
    }

    const capacity = course.capacity ?? course.groupSize ?? course.maxCapacity;
    const available =
      course.spotsLeft ?? course.availableSpots ?? course.spotsAvailable ?? course.remainingSpots ?? course.openSpots;

    if (capacity == null && available == null) {
      return null;
    }

    return { capacity, available };
  });

  constructor() {
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
          this.course.set(null);
          return this.api.getCourse(id).pipe(finalize(() => this.isLoading.set(false)));
        })
      )
      .subscribe({
        next: (course) => {
          this.course.set(course as EnrichedCourseDetail);
          this.loadMyRating();
        },
        error: () => {
          this.course.set(null);
          this.hasError.set(true);
        }
      });
  }

  ngOnInit(): void {
    // Component initialization
  }

  onEnroll(): void {
    const course = this.course();
    if (!course) {
      return;
    }

    if (this.authService.isLoggedIn()) {
      void this.router.navigate(['/account/checkout'], {
        queryParams: { kind: 'COURSE', id: course.id }
      });
      return;
    }

    void this.router.navigate(['/login'], {
      queryParams: { redirect: '/account/checkout', kind: 'COURSE', id: course.id }
    });
  }

  sportLabel(value: CourseDetail['sport']): string {
    // If it's a PublicSport object, return the name directly
    if (value && typeof value === 'object' && 'name' in value) {
      return value.name;
    }
    
    // Fallback for old string-based sport codes
    const sportCode = value as string | undefined;
    switch (sportCode) {
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
        return sportCode ?? 'Nespecificat';
    }
  }

  levelLabel(value: CourseDetail['level']): string {
    switch (value) {
      case 'incepator':
        return 'Nivel incepator';
      case 'intermediar':
        return 'Nivel intermediar';
      case 'avansat':
        return 'Nivel avansat';
      default:
        return value ?? 'Nivel mixt';
    }
  }

  ageRange(course: CourseDetail | null): string {
    if (!course) {
      return 'Nespecificat';
    }
    const { ageMin, ageMax } = course;
    if (ageMin && ageMax) {
      return `${ageMin}-${ageMax} ani`;
    }
    if (ageMin) {
      return `De la ${ageMin} ani`;
    }
    if (ageMax) {
      return `Pana la ${ageMax} ani`;
    }
    return 'Nespecificat';
  }

  coachLink(course: CourseDetail | null): string[] | null {
    if (!course?.coach?.id) {
      return null;
    }
    return ['/antrenori'];
  }

  private resolveUrl(url: string): string {
    if (!url) return url;
    // If already absolute, return as is
    if (/^https?:\/\//i.test(url)) return url;

    // Ensure base URL has no trailing slash
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    if (!base) return url; // fallback to original relative (same-origin)

    // Ensure URL starts with a slash
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  loadMyRating(): void {
    const course = this.course();
    if (!course || !this.authService.isLoggedIn() || this.authService.getCurrentUser()?.role !== 'PARENT') {
      return;
    }

    this.ratingService.getMyCourseRating(course.id)
      .pipe(catchError(() => of(null)))
      .subscribe(rating => {
        this.myRating.set(rating);
      });
  }

  onRateCourse(): void {
    const course = this.course();
    if (!course) {
      return;
    }

    if (!this.authService.isLoggedIn()) {
      void this.router.navigate(['/login'], {
        queryParams: { redirect: this.router.url }
      });
      return;
    }

    const dialogData: RatingDialogData = {
      entityType: 'course',
      entityId: course.id,
      entityName: course.name,
      existingRating: this.myRating() || undefined
    };

    const dialogRef = this.dialog.open(RatingDialogComponent, {
      width: '500px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.myRating.set(result);
        // Refresh course to get updated average rating
        this.api.getCourse(course.id).subscribe(updatedCourse => {
          this.course.set(updatedCourse as EnrichedCourseDetail);
        });
      }
    });
  }

  get canRate(): boolean {
    return this.authService.isLoggedIn() && this.authService.getCurrentUser()?.role === 'PARENT';
  }

  get ratingButtonText(): string {
    return this.myRating() ? 'Actualizează rating' : 'Evaluează cursul';
  }
}
