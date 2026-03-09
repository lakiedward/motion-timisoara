import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import {
  AuthResponse,
  ClubCodeValidationResponse,
  ClubRegistrationResponse,
  CoachRegistrationResponse,
  CompleteProfileRequest,
  ForgotPasswordRequest,
  LoginRequest,
  OnboardingLinkResponse,
  RegisterClubRequest,
  RegisterCoachRequest,
  RegisterParentRequest,
  ResetPasswordRequest,
  StripeAccountStatus,
  User,
  ValidateClubCodeRequest,
} from '../models/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    if (this.isBrowser()) {
      // Load initial session
      this.loadSession();

      // Listen for auth state changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          this.loadProfile(session.user.id);
        } else {
          this.currentUserSubject.next(null);
        }
      });
    }
  }

  private async loadSession(): Promise<void> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session?.user) {
      await this.loadProfile(session.user.id);
    }
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      this.currentUserSubject.next({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        phone: profile.phone,
        oauthProvider: profile.oauth_provider,
        avatarUrl: profile.avatar_url,
        needsProfileCompletion: !profile.phone,
      });
    }
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return from(
      this.supabase.auth.signInWithPassword({
        email: request.email,
        password: request.password,
      }),
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        return from(this.loadProfileAndReturn(data.user!.id));
      }),
    );
  }

  registerParent(request: RegisterParentRequest): Observable<AuthResponse> {
    return from(
      this.supabase.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          data: {
            name: request.name,
            phone: request.phone || null,
            role: 'PARENT',
          },
        },
      }),
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        return from(this.loadProfileAndReturn(data.user!.id));
      }),
    );
  }

  registerCoach(request: RegisterCoachRequest): Observable<CoachRegistrationResponse> {
    return from(this.supabase.invokeFunction<CoachRegistrationResponse>('register-coach', request));
  }

  registerClub(request: RegisterClubRequest): Observable<ClubRegistrationResponse> {
    return from(this.supabase.invokeFunction<ClubRegistrationResponse>('register-club', request));
  }

  validateClubCode(request: ValidateClubCodeRequest): Observable<ClubCodeValidationResponse> {
    return from(
      this.supabase
        .from('club_invitation_codes')
        .select('id, code, club:clubs(name)')
        .eq('code', request.code)
        .eq('active', true)
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return { valid: false, message: 'Cod invalid sau expirat' };
        }
        const clubName = (data as any).club?.name;
        return { valid: true, message: 'Cod valid', clubName };
      }),
    );
  }

  requestPasswordReset(request: ForgotPasswordRequest): Observable<any> {
    return from(
      this.supabase.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    );
  }

  resetPassword(request: ResetPasswordRequest): Observable<any> {
    return from(
      this.supabase.auth.updateUser({ password: request.newPassword }),
    );
  }

  // Stripe Connect methods
  getStripeAccountStatus(): Observable<StripeAccountStatus> {
    return from(this.supabase.invokeFunction<StripeAccountStatus>('stripe-connect', { action: 'status' }));
  }

  getStripeOnboardingLink(): Observable<OnboardingLinkResponse> {
    return from(this.supabase.invokeFunction<OnboardingLinkResponse>('stripe-connect', { action: 'onboarding-link' }));
  }

  getStripeDashboardLink(): Observable<OnboardingLinkResponse> {
    return from(this.supabase.invokeFunction<OnboardingLinkResponse>('stripe-connect', { action: 'dashboard-link' }));
  }

  refreshStripeStatus(): Observable<StripeAccountStatus> {
    return from(this.supabase.invokeFunction<StripeAccountStatus>('stripe-connect', { action: 'refresh-status' }));
  }

  me(): Observable<User> {
    return from(this.supabase.auth.getSession()).pipe(
      switchMap(({ data: { session } }) => {
        if (!session?.user) throw new Error('Not authenticated');
        return from(
          this.supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single(),
        );
      }),
      map(({ data, error }) => {
        if (error || !data) throw error || new Error('Profile not found');
        const user: User = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          phone: data.phone,
          oauthProvider: data.oauth_provider,
          avatarUrl: data.avatar_url,
          needsProfileCompletion: !data.phone,
        };
        this.currentUserSubject.next(user);
        return user;
      }),
    );
  }

  logout(): Observable<any> {
    return from(this.supabase.auth.signOut()).pipe(
      tap(() => this.currentUserSubject.next(null)),
    );
  }

  refreshToken(): Observable<any> {
    return from(this.supabase.auth.refreshSession());
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  loginWithGoogle(redirectUrl?: string): void {
    if (!this.isBrowser()) return;

    const redirectTo = redirectUrl
      ? `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`
      : `${window.location.origin}/auth/callback`;

    this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }

  handleOAuthCallback(): Observable<User> {
    return this.me();
  }

  completeProfile(request: CompleteProfileRequest): Observable<User> {
    return from(this.supabase.auth.getSession()).pipe(
      switchMap(({ data: { session } }) => {
        if (!session?.user) throw new Error('Not authenticated');
        const updates: any = { phone: request.phone };
        if (request.name) updates.name = request.name;
        return from(
          this.supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id)
            .select()
            .single(),
        );
      }),
      map(({ data, error }) => {
        if (error || !data) throw error || new Error('Update failed');
        const user: User = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          phone: data.phone,
          oauthProvider: data.oauth_provider,
          avatarUrl: data.avatar_url,
          needsProfileCompletion: !data.phone,
        };
        this.currentUserSubject.next(user);
        return user;
      }),
    );
  }

  clearAuthState(): void {
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return null;
  }

  popOAuthReturnUrl(): string | null {
    if (!this.isBrowser()) return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('returnUrl');
  }

  private async loadProfileAndReturn(userId: string): Promise<AuthResponse> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) throw new Error('Profile not found');

    const user: User = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      phone: profile.phone,
      oauthProvider: profile.oauth_provider,
      avatarUrl: profile.avatar_url,
      needsProfileCompletion: !profile.phone,
    };

    this.currentUserSubject.next(user);
    return { user };
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
