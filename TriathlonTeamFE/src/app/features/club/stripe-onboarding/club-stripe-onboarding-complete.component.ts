import { Component, OnInit, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClubService } from '../services/club.service';

@Component({
  selector: 'app-club-stripe-onboarding-complete',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="page-wrapper">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-background">
          <div class="hero-gradient"></div>
        </div>
        <div class="hero-container">
          <div class="hero-content">
            <span class="hero-badge">
              <mat-icon>account_balance</mat-icon>
              Configurare Plăți Club
            </span>
            <h1 class="hero-title">Stripe Connect</h1>
            <p class="hero-subtitle">Configurează contul clubului pentru a primi plăți</p>
          </div>
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
                <p>Verificăm configurarea contului Stripe al clubului</p>
              </div>
            } @else if (isComplete()) {
              <div class="status-content success">
                <div class="status-icon-wrapper success-icon">
                  <mat-icon>check_circle</mat-icon>
                </div>
                <h2>Felicitări! Configurare completă</h2>
                <p>Contul Stripe al clubului este acum activ și puteți primi plăți.</p>
                
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
                  <a routerLink="/club" class="btn-primary">
                    <mat-icon>dashboard</mat-icon>
                    Mergi la Dashboard
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
                  <a routerLink="/club" class="btn-text">
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
  styles: [`
    .page-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
    }
    
    .hero {
      position: relative;
      padding: 4rem 2rem;
      text-align: center;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
    }
    
    .hero-gradient {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%);
    }
    
    .hero-container {
      position: relative;
      z-index: 1;
    }
    
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(255,255,255,0.2);
      border-radius: 50px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    
    .hero-title {
      font-size: 2.5rem;
      font-weight: 800;
      margin: 0 0 0.5rem;
    }
    
    .hero-subtitle {
      font-size: 1.125rem;
      opacity: 0.9;
      margin: 0;
    }
    
    .content-section {
      padding: 3rem 2rem;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    
    .status-card {
      background: white;
      border-radius: 24px;
      padding: 3rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      text-align: center;
    }
    
    .status-icon-wrapper {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      
      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
      }
    }
    
    .loading-icon {
      background: #f1f5f9;
    }
    
    .success-icon {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
    }
    
    .pending-icon {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .status-content h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem;
    }
    
    .status-content p {
      color: #64748b;
      margin: 0;
    }
    
    .features-grid {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f8fafc;
      border-radius: 16px;
      border: 1px solid rgba(37, 99, 235, 0.3);
    }
    
    .feature-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      
      mat-icon {
        color: #2563eb;
      }
      
      span {
        font-size: 0.875rem;
        color: #64748b;
      }
    }
    
    .info-box {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: #eff6ff;
      border-radius: 12px;
      margin: 1.5rem 0;
      text-align: left;
      
      mat-icon {
        color: #2563eb;
        flex-shrink: 0;
      }
      
      strong {
        color: #1e40af;
        display: block;
        margin-bottom: 0.25rem;
      }
      
      p {
        color: #1e3a8a;
        font-size: 0.875rem;
      }
    }
    
    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 2rem;
    }
    
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      border: none;
      border-radius: 50px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
      }
      
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    
    .btn-text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      text-decoration: none;
      font-weight: 500;
      
      &:hover {
        color: #2563eb;
      }
    }
    
    .trust-section {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }
    
    .trust-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.875rem;
      
      mat-icon {
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }
    }
  `]
})
export class ClubStripeOnboardingCompleteComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isLoading = signal(true);
  readonly isComplete = signal(false);

  ngOnInit(): void {
    this.checkStatus();
  }

  private checkStatus(): void {
    this.clubService.refreshStripeStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.isComplete.set(status.stripeOnboardingComplete);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
  }

  continueOnboarding(): void {
    this.isLoading.set(true);
    this.clubService.getStripeOnboardingLink()
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
