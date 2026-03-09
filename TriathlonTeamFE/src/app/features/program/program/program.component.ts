import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, AfterViewInit, computed, inject, signal, DestroyRef, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import {
  LocationSummary,
  ProgramCourse,
  PublicApiService,
  ScheduleFilters
} from '../../../core/services/public-api.service';
import { FilterPanelComponent } from '../filter-panel/filter-panel.component';
import { CourseCardComponent } from '../course-card/course-card.component';

@Component({
  selector: 'app-program',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FilterPanelComponent, CourseCardComponent],
  templateUrl: './program.component.html',
  styleUrls: ['./program.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgramComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly api = inject(PublicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private currentFilters: ScheduleFilters = { page: 0, size: 9 };
  private intersectionObserver?: IntersectionObserver;
  private hasLoadedInitialData = false;
  private currentDaysOfWeek?: number[];

  readonly courses = signal<ProgramCourse[]>([]);
  readonly locations = signal<LocationSummary[]>([]);
  readonly isLoading = signal(false);
  readonly skeletonItems = Array.from({ length: 3 }, (_, index) => index);
  readonly isEmpty = computed(() => !this.isLoading() && this.courses().length === 0);
  scrollProgress = 0;
  sortBy = '';

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadInitialDataIfNeeded();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      // Ensure data loads after hydration when prerendered via SSR
      this.loadInitialDataIfNeeded();
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

  onFiltersChange(filters: ScheduleFilters & { daysOfWeek?: number[] }): void {
    this.currentFilters = { ...this.currentFilters, ...filters, page: 0 };
    // Eliminăm daysOfWeek din filtrele trimise către backend
    // și îl procesăm pe partea de frontend
    const { daysOfWeek, ...backendFilters } = this.currentFilters as any;
    this.currentFilters = backendFilters;
    this.currentDaysOfWeek = daysOfWeek;
    
    if (!this.isBrowser) {
      return;
    }
    this.loadSchedule(daysOfWeek, this.sortBy);
  }

  onSortChange(): void {
    if (!this.isBrowser) {
      return;
    }
    this.loadSchedule(this.currentDaysOfWeek, this.sortBy);
  }

  viewCourseDetails(courseId: string): void {
    void this.router.navigate(['/cursuri', courseId]);
  }

  enroll(courseId: string): void {
    if (this.authService.isLoggedIn()) {
      void this.router.navigate(['/account/checkout'], { queryParams: { kind: 'COURSE', id: courseId } });
      return;
    }
    void this.router.navigate(['/login'], {
      queryParams: { redirect: '/account/checkout', kind: 'COURSE', id: courseId }
    });
  }

  private setupScrollReveal(): void {
    if (!this.isBrowser) return;

    const observerOptions: IntersectionObserverInit = {
      threshold: 0.05,
      rootMargin: '0px 0px -20px 0px'
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach(el => {
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
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        el.classList.add('revealed');
      }

      this.intersectionObserver?.observe(el);
    });
  }

  private loadInitialDataIfNeeded(): void {
    if (this.hasLoadedInitialData) {
      return;
    }
    this.hasLoadedInitialData = true;
    this.loadLocations();
    this.loadSchedule();
  }

  private loadSchedule(daysOfWeek?: number[], sortBy?: string): void {
    if (!this.isBrowser) {
      return;
    }
    this.isLoading.set(true);
    this.api
      .getSchedule(this.currentFilters)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.isLoading.set(false);
        // Refresh scroll reveal after content loads
        setTimeout(() => this.refreshScrollReveal(), 100);
      }))
      .subscribe({
        next: (response) => {
          let filteredCourses = response.content;
          
          // Dacă avem zile multiple selectate, filtrăm cursurile
          if (daysOfWeek && daysOfWeek.length > 0) {
            filteredCourses = filteredCourses.filter(course => {
              // Extragem zilele din toate occurrence-urile cursului
              const courseDays = new Set<number>();
              course.occurrences.forEach(occurrence => {
                const date = new Date(occurrence.startTime);
                const dayOfWeek = date.getDay(); // 0 = Duminică, 1 = Luni, etc.
                // Convertim: 0 (Duminică) -> 7, restul rămân la fel
                const normalizedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
                courseDays.add(normalizedDay);
              });
              
              // Verificăm dacă cursul conține TOATE zilele selectate
              return daysOfWeek.every(selectedDay => courseDays.has(selectedDay));
            });
          }
          
          // Aplicăm sortarea
          if (sortBy) {
            filteredCourses = this.sortCourses(filteredCourses, sortBy);
          }
          
          this.courses.set(filteredCourses);
        },
        error: () => {
          this.courses.set([]);
        }
      });
  }

  private sortCourses(courses: any[], sortBy: string): any[] {
    const sorted = [...courses];
    
    switch (sortBy) {
      case 'rating-desc':
        return sorted.sort((a, b) => {
          const ratingA = a.averageRating ?? 0;
          const ratingB = b.averageRating ?? 0;
          return ratingB - ratingA;
        });
      
      case 'rating-asc':
        return sorted.sort((a, b) => {
          const ratingA = a.averageRating ?? 0;
          const ratingB = b.averageRating ?? 0;
          return ratingA - ratingB;
        });
      
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      
      default:
        return sorted;
    }
  }

  private loadLocations(): void {
    this.api.getPublicLocations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => this.locations.set(locations ?? []),
        error: () => this.locations.set([])
      });
  }
}
