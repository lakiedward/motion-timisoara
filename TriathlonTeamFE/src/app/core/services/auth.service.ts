import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthResponse, ClubCodeValidationResponse, ClubRegistrationResponse, CoachRegistrationResponse, CompleteProfileRequest, ForgotPasswordRequest, LoginRequest, OnboardingLinkResponse, RegisterClubRequest, RegisterCoachRequest, RegisterParentRequest, ResetPasswordRequest, StripeAccountStatus, User, ValidateClubCodeRequest } from '../models/auth';
import { API_BASE_URL } from '../tokens/api-base-url.token';

const OAUTH_RETURN_URL_KEY = 'motion.oauth.returnUrl';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(API_BASE_URL) private apiBaseUrl: string,
  ) {
    // Only attempt to load user on browser (not during SSR)
    // Token is now in HttpOnly cookie, so we just try to fetch user info
    if (this.isBrowser()) {
      this.me().subscribe({
        next: (user) => {
          this.currentUserSubject.next(user);
        },
        error: (err: unknown) => {
          const status = (err as HttpErrorResponse)?.status;
          // Only log actual errors, not normal flow
          if (status && status !== 401) {
            console.error('[AuthService] Unexpected error loading user:', status);
          }
          // User not authenticated or cookie expired
          if (status === 401) {
            this.currentUserSubject.next(null);
          }
          // For other errors (network, 5xx, 4xx non-auth), keep trying
        },
      });
    }
  }

  requestPasswordReset(request: ForgotPasswordRequest): Observable<any> {
    return this.http.post('/api/auth/forgot-password', request, { withCredentials: true });
  }

  resetPassword(request: ResetPasswordRequest): Observable<any> {
    return this.http.post('/api/auth/reset-password', request, { withCredentials: true });
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', request, { withCredentials: true })
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  registerParent(request: RegisterParentRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register-parent', request, { withCredentials: true })
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  registerCoach(request: RegisterCoachRequest): Observable<CoachRegistrationResponse> {
    return this.http
      .post<CoachRegistrationResponse>('/api/auth/register-coach', request, { withCredentials: true })
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  registerClub(request: RegisterClubRequest): Observable<ClubRegistrationResponse> {
    return this.http
      .post<ClubRegistrationResponse>('/api/auth/register-club', request, { withCredentials: true })
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  validateClubCode(request: ValidateClubCodeRequest): Observable<ClubCodeValidationResponse> {
    return this.http.post<ClubCodeValidationResponse>('/api/auth/validate-club-code', request, { withCredentials: true });
  }

  // Stripe Connect methods for coaches
  getStripeAccountStatus(): Observable<StripeAccountStatus> {
    return this.http.get<StripeAccountStatus>('/api/coach/stripe/status', { withCredentials: true });
  }

  getStripeOnboardingLink(): Observable<OnboardingLinkResponse> {
    return this.http.get<OnboardingLinkResponse>('/api/coach/stripe/onboarding-link', { withCredentials: true });
  }

  getStripeDashboardLink(): Observable<OnboardingLinkResponse> {
    return this.http.get<OnboardingLinkResponse>('/api/coach/stripe/dashboard-link', { withCredentials: true });
  }

  refreshStripeStatus(): Observable<StripeAccountStatus> {
    return this.http.post<StripeAccountStatus>('/api/coach/stripe/refresh-status', {}, { withCredentials: true });
  }

  me(): Observable<User> {
    console.log('📡 [AuthService] Calling /api/auth/me with credentials');
    return this.http
      .get<User>('/api/auth/me', { withCredentials: true })
      .pipe(
        tap((user) => {
          console.log('✅ [AuthService] /api/auth/me response:', user);
          this.currentUserSubject.next(user);
        })
      );
  }

  logout(): Observable<any> {
    return this.http
      .post('/api/auth/logout', {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.currentUserSubject.next(null);
        })
      );
  }

  refreshToken(): Observable<any> {
    return this.http
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap((response: any) => {
          // Backend sets cookies, we just might need to update user state if returned
          // But usually refresh just returns tokens.
          // If we need to update user, we can call me() or if response has user.
        })
      );
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  loginWithGoogle(redirectUrl?: string): void {
    if (!this.isBrowser()) {
      return;
    }

    const sanitized = this.sanitizeReturnUrl(redirectUrl);
    if (sanitized) {
      sessionStorage.setItem(OAUTH_RETURN_URL_KEY, sanitized);
    } else {
      sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);
    }

    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    const url = base ? `${base}/oauth2/authorization/google` : '/oauth2/authorization/google';
    window.location.href = url;
  }

  popOAuthReturnUrl(): string | null {
    if (!this.isBrowser()) {
      return null;
    }
    const value = sessionStorage.getItem(OAUTH_RETURN_URL_KEY);
    if (value !== null) {
      sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);
      return this.sanitizeReturnUrl(value);
    }
    return null;
  }

  handleOAuthCallback(): Observable<User> {
    console.log('📡 [AuthService] handleOAuthCallback - calling /api/auth/me');
    return this.me();
  }

  completeProfile(request: CompleteProfileRequest): Observable<User> {
    return this.http
      .patch<User>('/api/auth/complete-profile', request, { withCredentials: true })
      .pipe(tap((user) => this.currentUserSubject.next(user)));
  }

  /**
   * Clear authentication state (set current user to null).
   * Used by HTTP interceptor when receiving 401 on protected endpoints.
   */
  clearAuthState(): void {
    this.currentUserSubject.next(null);
  }

  /**
   * @deprecated Token is now stored in HttpOnly cookie managed by backend.
   * This method returns null for backwards compatibility.
   */
  getToken(): string | null {
    return null;
  }

  private handleAuthResponse(response: AuthResponse): void {
    // Token is now set as HttpOnly cookie by backend
    // We only need to update the current user
    this.currentUserSubject.next(response.user);
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private sanitizeReturnUrl(redirectUrl?: string | null): string | null {
    if (!redirectUrl) {
      return null;
    }

    const trimmed = redirectUrl.trim();
    if (!trimmed) {
      return null;
    }

    const disallowed = ['/login', '/register', '/auth/callback'];
    for (const path of disallowed) {
      if (trimmed === path || trimmed.startsWith(`${path}?`)) {
        return null;
      }
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return null;
    }

    if (!trimmed.startsWith('/')) {
      return `/${trimmed}`;
    }

    return trimmed;
  }
}
