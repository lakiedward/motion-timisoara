import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { ClubService, ClubCoach, ClubInvitationCode, ClubDashboardStats, ClubProfile } from '../../services/club.service';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';
import { readFileAsDataUrl, validateImageFile } from '../../../../shared/utils/image-upload';

@Component({
  selector: 'app-club-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    DatePipe
  ],
  templateUrl: './club-dashboard.component.html',
  styleUrls: ['./club-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubDashboardComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly router = inject(Router);

  // State
  readonly profile = signal<ClubProfile | null>(null);
  readonly stats = signal<ClubDashboardStats | null>(null);
  readonly coaches = signal<ClubCoach[]>([]);
  readonly invitationCodes = signal<ClubInvitationCode[]>([]);
  readonly isLoading = signal(true);
  readonly codeFilter = signal<'all' | 'active' | 'used' | 'recent'>('recent');
  readonly failedCoachPhotoUserIds = signal<Set<string>>(new Set());

  // Branding
  readonly showBrandingEditor = signal(false);
  readonly brandingLogoPreview = signal<string | null>(null);
  readonly brandingHeroPreview = signal<string | null>(null);
  readonly brandingBusy = signal(false);
  readonly brandingLogoBust = signal<number>(0);
  readonly brandingHeroBust = signal<number>(0);

  // Computed
  readonly filteredInvitationCodes = computed(() => {
    const codes = this.invitationCodes();
    const filter = this.codeFilter();
    
    switch (filter) {
      case 'active':
        return codes.filter(c => c.isValid);
      case 'used':
        return codes.filter(c => !c.isValid);
      case 'recent':
        return codes.slice(0, 6);
      default:
        return codes;
    }
  });

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    
    forkJoin({
      profile: this.clubService.getProfile(),
      stats: this.clubService.getStats(),
      coaches: this.clubService.getCoaches(),
      codes: this.clubService.getInvitationCodes()
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: ({ profile, stats, coaches, codes }) => {
        this.profile.set(profile);
        this.stats.set(stats);
        this.coaches.set(coaches);
        this.invitationCodes.set(codes);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Eroare la încărcarea datelor', 'Închide', { duration: 3000 });
      }
    });
  }

  getActiveCodesCount(): number {
    return this.invitationCodes().filter(c => c.isValid).length;
  }

  setCodeFilter(filter: 'all' | 'active' | 'used' | 'recent'): void {
    this.codeFilter.set(filter);
  }

  generateInvitationCode(): void {
    this.clubService.createInvitationCode({ maxUses: 1, expiresInDays: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (code) => {
          this.invitationCodes.update(codes => [code, ...codes]);
          this.copyCode(code.code);
          this.snackBar.open('Cod generat și copiat în clipboard!', 'OK', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Eroare la generarea codului', 'Închide', { duration: 3000 });
        }
      });
  }

  copyCode(code: string): void {
    if (isPlatformBrowser(this.platformId)) {
      navigator.clipboard.writeText(code).then(() => {
        this.snackBar.open('Cod copiat!', '', { duration: 1500 });
      });
    }
  }

  deleteInvitationCode(code: ClubInvitationCode): void {
    if (!confirm(`Ștergi codul ${code.code}?`)) return;
    
    this.clubService.deleteInvitationCode(code.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.invitationCodes.update(codes => codes.filter(c => c.id !== code.id));
          this.snackBar.open('Cod șters', '', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Eroare la ștergere', 'Închide', { duration: 3000 });
        }
      });
  }

  removeCoach(coach: ClubCoach): void {
    if (!confirm(`Elimini antrenorul ${coach.name} din club?`)) return;
    
    this.clubService.removeCoach(coach.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.coaches.update(list => list.filter(c => c.id !== coach.id));
          this.snackBar.open('Antrenor eliminat', '', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Eroare la eliminare', 'Închide', { duration: 3000 });
        }
      });
  }

  editCoach(coach: ClubCoach): void {
    void this.router.navigate(['/club/coaches', coach.id, 'edit']);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getCoachPhotoUrl(coachUserId: string): string {
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachUserId}/photo`;
  }

  canShowCoachPhoto(coach: ClubCoach): boolean {
    if (!coach?.hasPhoto) return false;
    return !this.failedCoachPhotoUserIds().has(coach.userId);
  }

  onCoachPhotoError(coachUserId: string): void {
    this.failedCoachPhotoUserIds.update((set) => {
      const next = new Set(set);
      next.add(coachUserId);
      return next;
    });
  }

  openStripeOnboarding(): void {
    this.clubService.getStripeOnboardingLink()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          if (isPlatformBrowser(this.platformId)) {
            window.location.href = url;
          }
        },
        error: () => {
          this.snackBar.open('Eroare la deschiderea Stripe', 'Închide', { duration: 3000 });
        }
      });
  }

  openStripeDashboard(): void {
    this.clubService.getStripeDashboardLink()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          if (isPlatformBrowser(this.platformId)) {
            window.open(url, '_blank');
          }
        },
        error: () => {
          this.snackBar.open('Eroare la deschiderea dashboard-ului', 'Închide', { duration: 3000 });
        }
      });
  }

  toggleBrandingEditor(): void {
    this.showBrandingEditor.update((v) => !v);
    if (!this.showBrandingEditor()) {
      this.brandingLogoPreview.set(null);
      this.brandingHeroPreview.set(null);
    }
  }

  onBrandingLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (this.brandingBusy()) {
      input.value = '';
      return;
    }

    const file = input.files[0];
    const error = validateImageFile(file);
    if (error) {
      this.snackBar.open(error, 'Închide', { duration: 4000 });
      input.value = '';
      return;
    }

    input.value = '';

    this.brandingBusy.set(true);
    void readFileAsDataUrl(file)
      .then((dataUrl) => {
        this.brandingLogoPreview.set(dataUrl);
        this.clubService
          .uploadProfileLogo(dataUrl)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (profile) => {
              this.profile.set(profile);
              this.brandingLogoPreview.set(null);
              this.brandingLogoBust.set(Date.now());
              this.brandingBusy.set(false);
              this.snackBar.open('Logo actualizat', '', { duration: 2500 });
            },
            error: (err) => {
              this.brandingBusy.set(false);
              this.brandingLogoPreview.set(null);
              const message = err?.error?.message || 'Nu am putut salva logo-ul';
              this.snackBar.open(message, 'Închide', { duration: 5000 });
            }
          });
      })
      .catch(() => {
        this.brandingBusy.set(false);
        this.snackBar.open('Nu am putut citi imaginea', 'Închide', { duration: 4000 });
      });
  }

  onBrandingHeroSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (this.brandingBusy()) {
      input.value = '';
      return;
    }

    const file = input.files[0];
    const error = validateImageFile(file);
    if (error) {
      this.snackBar.open(error, 'Închide', { duration: 4000 });
      input.value = '';
      return;
    }

    input.value = '';

    this.brandingBusy.set(true);
    void readFileAsDataUrl(file)
      .then((dataUrl) => {
        this.brandingHeroPreview.set(dataUrl);
        this.clubService
          .uploadProfileHeroPhoto(dataUrl)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (profile) => {
              this.profile.set(profile);
              this.brandingHeroPreview.set(null);
              this.brandingHeroBust.set(Date.now());
              this.brandingBusy.set(false);
              this.snackBar.open('Imaginea de copertă a fost actualizată', '', { duration: 3000 });
            },
            error: (err) => {
              this.brandingBusy.set(false);
              this.brandingHeroPreview.set(null);
              const message = err?.error?.message || 'Nu am putut salva imaginea de copertă';
              this.snackBar.open(message, 'Închide', { duration: 5000 });
            }
          });
      })
      .catch(() => {
        this.brandingBusy.set(false);
        this.snackBar.open('Nu am putut citi imaginea', 'Închide', { duration: 4000 });
      });
  }

  deleteBrandingLogo(): void {
    if (this.brandingBusy()) return;
    if (!confirm('Ștergi logo-ul clubului?')) return;

    this.brandingBusy.set(true);
    this.clubService
      .deleteProfileLogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.brandingLogoPreview.set(null);
          this.brandingLogoBust.set(Date.now());
          this.brandingBusy.set(false);
          this.snackBar.open('Logo șters', '', { duration: 2500 });
        },
        error: (err) => {
          this.brandingBusy.set(false);
          const message = err?.error?.message || 'Nu am putut șterge logo-ul';
          this.snackBar.open(message, 'Închide', { duration: 5000 });
        }
      });
  }

  deleteBrandingHeroPhoto(): void {
    if (this.brandingBusy()) return;
    if (!confirm('Ștergi imaginea de copertă?')) return;

    this.brandingBusy.set(true);
    this.clubService
      .deleteProfileHeroPhoto()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.brandingHeroPreview.set(null);
          this.brandingHeroBust.set(Date.now());
          this.brandingBusy.set(false);
          this.snackBar.open('Imaginea de copertă a fost ștearsă', '', { duration: 3000 });
        },
        error: (err) => {
          this.brandingBusy.set(false);
          const message = err?.error?.message || 'Nu am putut șterge imaginea de copertă';
          this.snackBar.open(message, 'Închide', { duration: 5000 });
        }
      });
  }

  getClubLogoUrl(): string | null {
    const url = this.profile()?.logoUrl;
    return this.normalizeAssetUrl(url, this.brandingLogoBust());
  }

  getClubHeroPhotoUrl(): string | null {
    const url = this.profile()?.heroPhotoUrl ?? null;
    return this.normalizeAssetUrl(url, this.brandingHeroBust());
  }

  private normalizeAssetUrl(url: string | null | undefined, bust?: number | null): string | null {
    const raw = String(url ?? '').trim();
    if (!raw) return null;

    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');

    let resolved = raw;
    if (!hasScheme && base) {
      resolved = raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
    } else if (!hasScheme && !raw.startsWith('/')) {
      resolved = `/${raw}`;
    }

    const bustValue = Number(bust ?? 0);
    if (bustValue > 0) {
      const separator = resolved.includes('?') ? '&' : '?';
      resolved = `${resolved}${separator}v=${bustValue}`;
    }

    return resolved;
  }

  getDashboardHeroBackground(): string | null {
    const heroUrl = this.getClubHeroPhotoUrl();
    if (!heroUrl) return null;

    return `linear-gradient(135deg, rgba(15, 23, 42, 0.55) 0%, rgba(15, 23, 42, 0.35) 50%, rgba(15, 23, 42, 0.25) 100%), url("${heroUrl}")`;
  }
}
