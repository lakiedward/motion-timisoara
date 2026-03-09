import { ChangeDetectionStrategy, Component, OnInit, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { PublicApiService, PublicActivitySummary } from '../../../core/services/public-api.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-activities-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './activities-page.component.html',
  styleUrls: ['./activities-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly api = inject(PublicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly supabase = inject(SupabaseService);

  readonly activities = signal<PublicActivitySummary[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  isPast(activity: PublicActivitySummary): boolean {
    return this.isActivityPast(activity, Date.now());
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadActivities();
    }
  }

  loadActivities(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    
    this.api.getActivities(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activities) => {
          const list = activities ?? [];
          const now = Date.now();
          const upcoming = list.filter((a) => !this.isActivityPast(a, now));
          const past = list.filter((a) => this.isActivityPast(a, now));

          upcoming.sort((a, b) => this.getActivityStartMs(a) - this.getActivityStartMs(b));
          past.sort((a, b) => this.getActivityStartMs(b) - this.getActivityStartMs(a));

          this.activities.set([...upcoming, ...past]);
          this.isLoading.set(false);
        },
        error: () => {
          this.activities.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });
  }

  viewDetails(activityId: string): void {
    void this.router.navigate(['/activitati', activityId]);
  }

  enroll(activityId: string): void {
    if (this.authService.isLoggedIn()) {
      void this.router.navigate(['/account/checkout'], { 
        queryParams: { kind: 'ACTIVITY', id: activityId } 
      });
      return;
    }
    void this.router.navigate(['/login'], {
      queryParams: { redirect: '/account/checkout', kind: 'ACTIVITY', id: activityId }
    });
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

  getHeroPhotoUrl(activity: PublicActivitySummary): string | null {
    if (!activity.heroPhotoUrl) return null;
    return this.resolveUrl(activity.heroPhotoUrl);
  }

  private isActivityPast(activity: PublicActivitySummary, now: number): boolean {
    const end = this.toLocalDateTime(activity.activityDate, activity.endTime || activity.startTime);
    if (!end) return false;
    return end.getTime() < now;
  }

  private getActivityStartMs(activity: PublicActivitySummary): number {
    const start = this.toLocalDateTime(activity.activityDate, activity.startTime);
    return start ? start.getTime() : 0;
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
