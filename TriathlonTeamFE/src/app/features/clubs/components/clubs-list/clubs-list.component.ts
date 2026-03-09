import { CommonModule, isPlatformBrowser } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { PublicApiService, PublicClubSummary } from '../../../../core/services/public-api.service';
import { Router } from '@angular/router';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

@Component({
  selector: 'app-clubs-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clubs-list.component.html',
  styleUrls: ['./clubs-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubsListComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(PublicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private intersectionObserver?: IntersectionObserver;
  private hasLoadedInitialData = false;

  readonly clubs = signal<PublicClubSummary[]>([]);
  readonly isLoading = signal(false);
  readonly skeletonItems = Array.from({ length: 6 }, (_, index) => index);
  readonly isEmpty = computed(() => !this.isLoading() && this.clubs().length === 0);

  scrollProgress = 0;
  sortBy = '';

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadInitialDataIfNeeded();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.loadInitialDataIfNeeded();
      this.setupScrollReveal();
      setTimeout(() => this.refreshScrollReveal(), 500);
    }
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
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

  onSortChange(): void {
    if (!this.isBrowser) return;
    this.applySort();
  }

  trackByClub = (_: number, club: PublicClubSummary) => club.id;

  getClubLogoUrl(logoUrl: string | undefined): string | null {
    return this.normalizeAssetUrl(logoUrl);
  }

  getClubHeroPhotoUrl(heroPhotoUrl: string | null | undefined): string | null {
    return this.normalizeAssetUrl(heroPhotoUrl);
  }

  getInitials(name: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'C';
    const parts = trimmed.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? 'C';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return (first + second).toUpperCase();
  }

  goToClub(club: PublicClubSummary): void {
    if (!this.isBrowser) return;
    void this.router.navigate(['/cluburi', club.id]);
  }

  private normalizeAssetUrl(url: string | null | undefined): string | null {
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

  private loadInitialDataIfNeeded(): void {
    if (this.hasLoadedInitialData) {
      return;
    }
    this.hasLoadedInitialData = true;
    this.loadClubs();
  }

  private loadClubs(): void {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading.set(true);

    this.api
      .getPublicClubs()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
          setTimeout(() => this.refreshScrollReveal(), 100);
        })
      )
      .subscribe({
        next: (list) => {
          this.clubs.set(list ?? []);
          this.applySort();
        },
        error: () => {
          this.clubs.set([]);
        }
      });
  }

  private applySort(): void {
    const list = [...(this.clubs() ?? [])];

    switch (this.sortBy) {
      case 'name':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'city':
        list.sort((a, b) => (a.city || '').localeCompare(b.city || ''));
        break;
      case 'coaches-desc':
        list.sort((a, b) => (b.coachCount ?? 0) - (a.coachCount ?? 0));
        break;
      default:
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
    }

    this.clubs.set(list);
  }
}
