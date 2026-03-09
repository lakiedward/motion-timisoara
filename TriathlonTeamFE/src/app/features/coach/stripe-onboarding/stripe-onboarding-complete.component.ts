import { Component, OnInit, inject, signal, DestroyRef, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-stripe-onboarding-complete',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="page-wrapper">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-background">
          <img 
            src="/ui/landing/hero-swim.webp" 
            alt="Background" 
            class="hero-bg-image"
            (load)="onImageLoad($event)"
          />
          <div class="hero-overlay"></div>
        </div>
        <div class="hero-container">
          <div class="hero-content">
            <span class="hero-badge">
              <mat-icon>account_balance</mat-icon>
              Configurare Plăți
            </span>
            <h1 class="hero-title">Stripe Connect</h1>
            <p class="hero-subtitle">Configurează-ți contul pentru a primi plăți</p>
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
              <div class="status-content loading">
                <div class="status-icon-wrapper loading-icon">
                  <div class="spinner"></div>
                </div>
                <h2>Se verifică statusul...</h2>
                <p>Verificăm configurarea contului tău Stripe</p>
              </div>
            } @else if (isComplete()) {
              <div class="status-content success">
                <div class="status-icon-wrapper success-icon">
                  <mat-icon>check_circle</mat-icon>
                  <div class="success-particles">
                    <span></span><span></span><span></span><span></span>
                  </div>
                </div>
                <h2>Felicitări! Configurare completă</h2>
                <p>Contul tău Stripe este acum activ și poți primi plăți de la cursanți.</p>
                
                <div class="features-grid">
                  <div class="feature-item">
                    <mat-icon>payments</mat-icon>
                    <span>Plăți Online</span>
                  </div>
                  <div class="feature-item">
                    <mat-icon>security</mat-icon>
                    <span>Tranzacții Securizate</span>
                  </div>
                  <div class="feature-item">
                    <mat-icon>speed</mat-icon>
                    <span>Transfer Rapid</span>
                  </div>
                </div>

                <div class="action-buttons">
                  <a routerLink="/coach" class="btn-primary">
                    <mat-icon>dashboard</mat-icon>
                    Mergi la Dashboard
                  </a>
                  <a routerLink="/coach/courses" class="btn-secondary">
                    Creează primul curs
                    <mat-icon>arrow_forward</mat-icon>
                  </a>
                </div>
              </div>
            } @else {
              <div class="status-content pending">
                <div class="status-icon-wrapper pending-icon">
                  <mat-icon>hourglass_top</mat-icon>
                </div>
                <h2>Configurare în așteptare</h2>
                <p>Mai sunt câțiva pași de finalizat pentru a putea primi plăți.</p>
                
                <div class="info-box">
                  <mat-icon>info</mat-icon>
                  <div>
                    <strong>Ce trebuie să faci?</strong>
                    <p>Completează verificarea identității și adaugă datele bancare în Stripe.</p>
                  </div>
                </div>

                <div class="action-buttons">
                  <button class="btn-primary" (click)="continueOnboarding()" [disabled]="isLoading()">
                    <mat-icon>launch</mat-icon>
                    Continuă configurarea
                  </button>
                  <a routerLink="/coach" class="btn-text">
                    <mat-icon>arrow_back</mat-icon>
                    Fac asta mai târziu
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
            <div class="trust-badge">
              <mat-icon>gpp_good</mat-icon>
              <span>PCI Compliant</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./stripe-onboarding-complete.component.scss']
})
export class StripeOnboardingCompleteComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isLoading = signal(true);
  readonly isComplete = signal(false);

  ngOnInit(): void {
    this.checkStatus();
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }

  private checkStatus(): void {
    this.authService.refreshStripeStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.isComplete.set(status.onboardingComplete);
          this.isLoading.set(false);
        },
        error: () => {
          // If error (e.g., not logged in), show pending state
          this.isLoading.set(false);
        }
      });
  }

  continueOnboarding(): void {
    this.isLoading.set(true);
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
        }
      });
  }
}
