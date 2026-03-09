import { Component, OnInit, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-stripe-onboarding-refresh',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="page-wrapper">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-background">
          <img src="/ui/landing/hero-swim.webp" alt="Background" class="hero-bg-image" />
          <div class="hero-overlay"></div>
        </div>
        <div class="hero-container">
          <div class="hero-content">
            <span class="hero-badge">
              <mat-icon>refresh</mat-icon>
              Reînnoire Link
            </span>
            <h1 class="hero-title">Stripe Connect</h1>
            <p class="hero-subtitle">Generăm un nou link de configurare</p>
          </div>
        </div>
        <div class="hero-wave">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path d="M0,50 C280,100 720,0 1440,50 L1440,100 L0,100 Z" fill="#ffffff"/>
          </svg>
        </div>
      </section>

      <!-- Main Content -->
      <section class="content-section">
        <div class="container">
          <div class="status-card">
            @if (isLoading()) {
              <div class="status-content">
                <div class="status-icon-wrapper loading-icon">
                  <div class="spinner"></div>
                </div>
                <h2>Se generează un nou link...</h2>
                <p>Te vom redirecționa automat către Stripe</p>
              </div>
            } @else if (hasError()) {
              <div class="status-content">
                <div class="status-icon-wrapper error-icon">
                  <mat-icon>link_off</mat-icon>
                </div>
                <h2>Link expirat</h2>
                <p>Link-ul de configurare a expirat. Apasă butonul pentru a genera unul nou.</p>
                
                <div class="info-box">
                  <mat-icon>info</mat-icon>
                  <div>
                    <strong>De ce a expirat?</strong>
                    <p>Link-urile Stripe sunt valide doar 15 minute din motive de securitate.</p>
                  </div>
                </div>

                <div class="action-buttons">
                  <button class="btn-primary" (click)="generateNewLink()">
                    <mat-icon>refresh</mat-icon>
                    Generează link nou
                  </button>
                  <a routerLink="/coach" class="btn-text">
                    <mat-icon>arrow_back</mat-icon>
                    Înapoi la Dashboard
                  </a>
                </div>
              </div>
            }
          </div>

          <!-- Trust Badges -->
          <div class="trust-section">
            <div class="trust-badge">
              <mat-icon>lock</mat-icon>
              <span>Date criptate SSL</span>
            </div>
            <div class="trust-badge">
              <mat-icon>verified_user</mat-icon>
              <span>Powered by Stripe</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./stripe-onboarding-refresh.component.scss']
})
export class StripeOnboardingRefreshComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.generateNewLink();
  }

  generateNewLink(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.authService.getStripeOnboardingLink()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (isPlatformBrowser(this.platformId)) {
            window.location.href = response.url;
          }
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });
  }
}
