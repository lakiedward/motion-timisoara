import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, inject, signal, computed, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CoachSummary, CoachFilters, PublicApiService, LocationSummary } from '../../../../core/services/public-api.service';
import { CoachFilterPanelComponent } from '../coach-filter-panel/coach-filter-panel.component';
import { CoachCardComponent } from '../coach-card/coach-card.component';

@Component({
  selector: 'app-coaches-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CoachFilterPanelComponent, CoachCardComponent],
  templateUrl: './coaches-list.component.html',
  styleUrls: ['./coaches-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachesListComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(PublicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  
  private currentFilters: CoachFilters = {};
  private intersectionObserver?: IntersectionObserver;
  private hasLoadedInitialData = false;

  readonly coaches = signal<CoachSummary[]>([]);
  readonly locations = signal<LocationSummary[]>([]);
  readonly isLoading = signal(false);
  readonly skeletonItems = Array.from({ length: 3 }, (_, index) => index);
  readonly isEmpty = computed(() => !this.isLoading() && this.coaches().length === 0);
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

  onFiltersChange(filters: CoachFilters): void {
    this.currentFilters = { ...filters };
    if (!this.isBrowser) {
      return;
    }
    this.loadCoaches();
  }

  onSortChange(): void {
    if (!this.isBrowser) {
      return;
    }
    this.loadCoaches();
  }

  trackByCoach = (_: number, coach: CoachSummary) => coach.id;

  viewCoachProfile(coachId: string): void {
    void this.router.navigate(['/antrenori', coachId]);
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
    this.loadCoaches();
  }

  private loadCoaches(): void {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading.set(true);
    
    this.api
      .getCoaches(this.currentFilters)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.isLoading.set(false);
        // Refresh scroll reveal after content loads
        setTimeout(() => this.refreshScrollReveal(), 100);
      }))
      .subscribe({
        next: (list: CoachSummary[]) => {
          let sortedList = list ?? [];
          
          // Aplicăm sortarea
          if (this.sortBy) {
            sortedList = this.sortCoaches(sortedList, this.sortBy);
          }
          
          this.coaches.set(sortedList);
        },
        error: () => {
          this.coaches.set([]);
        }
      });
  }

  private sortCoaches(coaches: CoachSummary[], sortBy: string): CoachSummary[] {
    const sorted = [...coaches];
    
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
