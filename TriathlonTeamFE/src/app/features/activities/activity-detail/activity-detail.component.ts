import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed, DestroyRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { PublicApiService, PublicActivityDetail } from '../../../core/services/public-api.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { LocationMapComponent } from '../../program/course-details/location-map/location-map.component';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, LocationMapComponent],
  templateUrl: './activity-detail.component.html',
  styleUrls: ['./activity-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly api = inject(PublicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly supabase = inject(SupabaseService);

  readonly activity = signal<PublicActivityDetail | null>(null);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  // Resolved hero photo URL
  readonly resolvedHeroPhotoUrl = computed(() => {
    const act = this.activity();
    if (!act?.heroPhotoUrl) return null;
    return this.resolveUrl(act.heroPhotoUrl);
  });

  // Resolved coach avatar URL
  readonly resolvedCoachAvatarUrl = computed(() => {
    const act = this.activity();
    if (!act?.coach?.avatarUrl) return null;
    return this.resolveUrl(act.coach.avatarUrl);
  });

  readonly isPast = computed(() => {
    const act = this.activity();
    if (!act) return false;
    const end = this.toLocalDateTime(act.activityDate, act.endTime || act.startTime);
    if (!end) return false;
    return end.getTime() < Date.now();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.isBrowser) {
      this.loadActivity(id);
    }
  }

  loadActivity(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    
    this.api.getActivity(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activity) => {
          this.activity.set(activity);
          this.isLoading.set(false);
        },
        error: () => {
          this.activity.set(null);
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });
  }

  enroll(): void {
    const activity = this.activity();
    if (!activity) return;

    if (this.isPast()) {
      return;
    }

    if (this.authService.isLoggedIn()) {
      void this.router.navigate(['/account/checkout'], { 
        queryParams: { kind: 'ACTIVITY', id: activity.id } 
      });
      return;
    }
    void this.router.navigate(['/login'], {
      queryParams: { redirect: '/account/checkout', kind: 'ACTIVITY', id: activity.id }
    });
  }

  goBack(): void {
    void this.router.navigate(['/activitati']);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ro-RO', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }

  formatTime(timeStr: string): string {
    return timeStr?.substring(0, 5) || '';
  }

  getDuration(): string {
    const activity = this.activity();
    if (!activity) return '';
    
    const [startH, startM] = activity.startTime.split(':').map(Number);
    const [endH, endM] = activity.endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const duration = endMinutes - startMinutes;
    
    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${duration} min`;
  }

  isSoldOut(): boolean {
    const activity = this.activity();
    return activity?.spotsLeft === 0;
  }

  private toLocalDateTime(dateStr: string, timeStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    let hours = 0;
    let minutes = 0;
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      if (Number.isFinite(h)) hours = h;
      if (Number.isFinite(m)) minutes = m;
    }

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }

  private resolveUrl(url: string): string {
    if (!url) return url;
    // If already absolute, return as is
    if (/^https?:\/\//i.test(url)) return url;
    // Relative path: resolve via Supabase storage
    const { data } = this.supabase.storage('activity-photos').getPublicUrl(url);
    return data?.publicUrl ?? url;
  }
}
