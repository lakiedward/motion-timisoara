import { AsyncPipe, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import { Component, HostListener, inject, OnInit, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

// ============================================
// Types
// ============================================
type UserRole = 'PARENT' | 'CLUB' | 'COACH' | 'ADMIN';

interface NavItem {
  label: string;
  path: string;
  icon?: string;
  exact?: boolean;
}

interface NavDropdown {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService);

  readonly currentUser$ = this.authService.currentUser$;
  readonly currentYear = new Date().getFullYear();
  private routerSub?: Subscription;
  private userSub?: Subscription;
  private avatarLastFailedUrl: string | null = null;
  readonly avatarAttemptIndex = signal(0);

  // ============================================
  // Navigation Configuration
  // ============================================
  
  // Public dropdowns (always visible)
  readonly programsDropdown: NavDropdown = {
    id: 'programs',
    label: 'Programe',
    icon: 'sports',
    items: [
      { label: 'Cursuri', path: '/cursuri', icon: 'school' },
      { label: 'Tabere', path: '/tabere', icon: 'landscape' },
      { label: 'Activități', path: '/activitati', icon: 'directions_run' }
    ]
  };

  readonly teamDropdown: NavDropdown = {
    id: 'team',
    label: 'Echipă',
    icon: 'groups',
    items: [
      { label: 'Antrenori', path: '/antrenori', icon: 'groups' },
      { label: 'Cluburi', path: '/cluburi', icon: 'business' }
    ]
  };

  readonly aboutDropdown: NavDropdown = {
    id: 'about',
    label: 'Despre',
    icon: 'info',
    items: [
      { label: 'Despre noi', path: '/despre', icon: 'info' },
      { label: 'Contact', path: '/contact', icon: 'mail' }
    ]
  };

  // Account dropdown (logged in users)
  readonly accountDropdown: NavDropdown = {
    id: 'account',
    label: 'Contul meu',
    icon: 'person',
    items: [
      { label: 'Dashboard', path: '/account', icon: 'dashboard', exact: true },
      { label: 'Copiii mei', path: '/account/children', icon: 'child_care' },
      { label: 'Înscrieri și Plăți', path: '/account/enrollments', icon: 'how_to_reg' },
      { label: 'Anunțuri', path: '/account/announcements', icon: 'campaign' }
    ]
  };

  // Coach dropdown
  readonly coachDropdown: NavDropdown = {
    id: 'coach',
    label: 'Antrenor',
    icon: 'sports',
    items: [
      { label: 'Dashboard', path: '/coach/dashboard', icon: 'dashboard' },
      { label: 'Cluburile mele', path: '/coach/my-clubs', icon: 'business' },
      { label: 'Cursurile mele', path: '/coach/courses', icon: 'school' },
      { label: 'Locații', path: '/coach/locations', icon: 'location_on' },
      { label: 'Activități', path: '/coach/activities', icon: 'event' },
      { label: 'Prezențe & Plăți', path: '/coach/attendance-payments', icon: 'fact_check' },
      { label: 'Anunțuri', path: '/coach/announcements', icon: 'campaign' }
    ]
  };

  // Club dropdown
  readonly clubDropdown: NavDropdown = {
    id: 'club',
    label: 'Club',
    icon: 'business',
    items: [
      { label: 'Dashboard', path: '/club', icon: 'dashboard', exact: true },
      { label: 'Profil / Setări', path: '/club/profile', icon: 'settings' },
      { label: 'Antrenori', path: '/club/coaches', icon: 'groups' },
      { label: 'Locații', path: '/club/locations', icon: 'location_on' },
      { label: 'Cursuri', path: '/club/courses', icon: 'school' },
      { label: 'Prezențe & Plăți', path: '/club/attendance-payments', icon: 'fact_check' },
      { label: 'Anunțuri', path: '/club/announcements', icon: 'campaign' }
    ]
  };

  // Admin dropdown
  readonly adminDropdown: NavDropdown = {
    id: 'admin',
    label: 'Admin',
    icon: 'admin_panel_settings',
    items: [
      { label: 'Antrenori', path: '/admin/coaches', icon: 'groups' },
      { label: 'Cluburi', path: '/admin/clubs', icon: 'business' },
      { label: 'Utilizatori', path: '/admin/users', icon: 'people' },
      { label: 'Sporturi', path: '/admin/sports', icon: 'sports' },
      { label: 'Cursuri', path: '/admin/courses', icon: 'school' },
      { label: 'Locații', path: '/admin/locations', icon: 'location_on' },
      { label: 'Tabere', path: '/admin/camps', icon: 'landscape' },
      { label: 'Activități', path: '/admin/activities', icon: 'directions_run' },
      { label: 'Prezențe & Plăți', path: '/admin/attendance-payments', icon: 'fact_check' },
      { label: 'Plăți', path: '/admin/payments', icon: 'payments' },
      { label: 'Rapoarte', path: '/admin/reports', icon: 'insights' }
    ]
  };

  // UI State
  hideLogoImg = false;
  isScrolled = false;
  isMenuOpen = false;
  activeDropdown = signal<string | null>(null);

  // RouterLinkActive options (keep object identity stable for performance)
  readonly exactActiveOptions = { exact: true } as const;
  readonly subsetActiveOptions = { exact: false } as const;

  getActiveOptions(item: NavItem) {
    return item.exact ? this.exactActiveOptions : this.subsetActiveOptions;
  }

  // ============================================
  // Lifecycle
  // ============================================
  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.updateScrollState();
    }

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeAllMenus();
      });

    this.userSub = this.currentUser$.subscribe(() => {
      this.avatarLastFailedUrl = null;
      this.avatarAttemptIndex.set(0);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  // ============================================
  // Role Checks
  // ============================================
  canSeeCoach(role: UserRole | undefined): boolean {
    return role === 'COACH' || role === 'ADMIN';
  }

  canSeeClub(role: UserRole | undefined): boolean {
    return role === 'CLUB';
  }

  canSeeAdmin(role: UserRole | undefined): boolean {
    return role === 'ADMIN';
  }

  // ============================================
  // UI Interactions
  // ============================================
  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.updateScrollState();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Close dropdowns when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.nav-dropdown')) {
      this.activeDropdown.set(null);
    }
  }

  private updateScrollState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    this.isScrolled = scrollTop > 20;
  }

  toggleDropdown(id: string): void {
    if (this.activeDropdown() === id) {
      this.activeDropdown.set(null);
    } else {
      this.activeDropdown.set(id);
    }
  }

  openDropdown(id: string): void {
    this.activeDropdown.set(id);
  }

  closeDropdown(): void {
    this.activeDropdown.set(null);
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  closeAllMenus(): void {
    this.closeMenu();
    this.activeDropdown.set(null);
  }

  isTeamRouteActive(): boolean {
    const url = this.router.url || '';
    return url.startsWith('/antrenori') || url.startsWith('/cluburi');
  }

  // ============================================
  // Navigation
  // ============================================
  goTo(path: string): void {
    this.router.navigate([path]);
    this.closeAllMenus();
  }

  // ============================================
  // Auth
  // ============================================
  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/'], { replaceUrl: true }),
      error: () => this.router.navigate(['/'], { replaceUrl: true })
    });
    this.closeAllMenus();
  }

  // ============================================
  // Helpers
  // ============================================
  getInitials(name: string): string {
    if (!name) return 'U';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  onAvatarError(event?: Event): void {
    const src = (event?.target as HTMLImageElement | null)?.src || null;
    if (src && this.avatarLastFailedUrl === src) {
      return;
    }

    this.avatarLastFailedUrl = src;
    this.avatarAttemptIndex.update((idx) => idx + 1);
  }

  getResolvedAvatarUrl(user: { id: string; role?: UserRole; avatarUrl?: string | null }): string | null {
    const candidates = this.getAvatarCandidates(user);
    if (candidates.length === 0) {
      return null;
    }

    const idx = this.avatarAttemptIndex();
    if (idx < 0 || idx >= candidates.length) {
      return null;
    }

    return candidates[idx];
  }

  private getAvatarCandidates(user: { id: string; role?: UserRole; avatarUrl?: string | null }): string[] {
    const candidates: string[] = [];

    // For COACH accounts, prefer the public coach photo endpoint used across the app.
    if (user.role === 'COACH') {
      candidates.push(this.getCoachPhotoUrl(user.id));
    }

    const normalized = this.normalizeAvatarUrl(user.avatarUrl);
    if (normalized) {
      candidates.push(normalized);
    }

    // De-duplicate while preserving order
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const value = (candidate || '').trim();
      if (!value) return false;
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  private getCoachPhotoUrl(coachUserId: string): string {
    const { data } = this.supabase.storage('coach-photos').getPublicUrl(coachUserId);
    return data?.publicUrl ?? '';
  }

  private normalizeAvatarUrl(avatarUrl: string | null | undefined): string | null {
    const url = (avatarUrl || '').trim();
    if (!url) {
      return null;
    }

    // If already absolute URL (or has a scheme), return as is
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      return url;
    }

    // Relative path: resolve via Supabase storage
    const { data } = this.supabase.storage('avatars').getPublicUrl(url);
    return data?.publicUrl ?? url;
  }
}
