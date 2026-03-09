import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorSnackbarService } from '../../../shared/services/error-snackbar.service';
import { ProfileCompletionDialogComponent } from '../profile-completion-dialog/profile-completion-dialog.component';
import { User } from '../../../core/models/auth';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatDialogModule, MatIconModule, RouterLink],
  templateUrl: './oauth-callback.component.html',
  styleUrls: ['./oauth-callback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    console.log('🚀 [OAuthCallback] Component initialized - ngOnInit started!');
    console.log('🔍 [OAuthCallback] Current URL:', window.location.href);
    
    const params = this.route.snapshot.queryParamMap;
    const needsProfile = params.get('needsProfileCompletion') === 'true';
    const redirectParam = params.get('redirect');
    const reason = params.get('reason');

    console.log('🔍 [OAuthCallback] Query params:', {
      needsProfile,
      redirectParam,
      reason,
      allParams: Array.from(params.keys).map(k => `${k}=${params.get(k)}`).join(', ')
    });

    if (reason) {
      console.error('❌ [OAuthCallback] OAuth failed with reason:', reason);
      this.handleFailure(reason);
      return;
    }

    const target = this.authService.popOAuthReturnUrl() ?? redirectParam ?? '/account';
    console.log('🎯 [OAuthCallback] Target redirect:', target);

    console.log('📞 [OAuthCallback] Calling handleOAuthCallback (me endpoint)...');
    this.authService
      .handleOAuthCallback()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          console.log('✅ [OAuthCallback] User loaded successfully:', user);
          this.afterLogin(user, needsProfile, target);
        },
        error: (err) => {
          console.error('❌ [OAuthCallback] Failed to load user:', err);
          this.handleFailure('login_failed');
        },
      });
  }

  private afterLogin(user: User, needsProfile: boolean, target: string): void {
    const requiresProfileCompletion = needsProfile || user.needsProfileCompletion;
    
    console.log('👤 [OAuthCallback] After login:', {
      user,
      needsProfile,
      requiresProfileCompletion,
      target
    });

    if (requiresProfileCompletion) {
      console.log('📝 [OAuthCallback] Opening profile completion dialog');
      this.isLoading.set(false);
      this.dialog
        .open(ProfileCompletionDialogComponent, {
          data: {
            name: user.name,
            phone: user.phone,
          },
          disableClose: true,
        })
        .afterClosed()
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.navigateTo(target),
          error: () => this.navigateTo(target),
        });
      return;
    }

    console.log('🚀 [OAuthCallback] Navigating directly to:', target);
    this.navigateTo(target);
  }

  private navigateTo(target: string): void {
    console.log('🧭 [OAuthCallback] Navigating to:', target);
    this.isLoading.set(false);
    void this.router.navigateByUrl(target);
  }

  private handleFailure(reason: string): void {
    this.isLoading.set(false);
    const message = this.mapFailureReason(reason);
    this.error.set(message);
    this.snackbar.show(message);
    void this.router.navigate(['/login'], {
      queryParams: { error: 'oauth_failed', reason },
      replaceUrl: true,
    });
  }

  private mapFailureReason(reason: string): string {
    switch (reason) {
      case 'missing_email':
        return 'Contul Google nu are o adresa de email disponibila.';
      case 'provider_mismatch':
        return 'Adresa de email este deja folosita cu un alt tip de autentificare.';
      case 'missing_provider_id':
        return 'Nu am primit un identificator valid de la Google.';
      case 'invalid_authentication':
        return 'Cererea de autentificare nu este valida.';
      default:
        return 'Autentificarea cu Google a esuat. Incearca din nou.';
    }
  }
}

