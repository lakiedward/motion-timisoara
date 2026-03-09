import { Component, OnInit, inject, PLATFORM_ID, DestroyRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClubService } from '../services/club.service';

@Component({
  selector: 'app-club-stripe-onboarding-refresh',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="page-wrapper">
      <section class="content-section">
        <div class="container">
          <div class="status-card">
            <div class="status-icon-wrapper">
              <mat-icon>refresh</mat-icon>
            </div>
            <h2>Sesiunea a expirat</h2>
            <p>Link-ul de configurare Stripe a expirat. Te rugăm să generezi unul nou.</p>
            
            <div class="action-buttons">
              <button class="btn-primary" (click)="getNewLink()">
                <mat-icon>launch</mat-icon>
                Generează link nou
              </button>
              <a routerLink="/club" class="btn-text">
                <mat-icon>arrow_back</mat-icon>
                Înapoi la Dashboard
              </a>
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
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    
    .container {
      max-width: 500px;
    }
    
    .status-card {
      background: white;
      border-radius: 24px;
      padding: 3rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      text-align: center;
      border: 1px solid rgba(37, 99, 235, 0.3);
    }
    
    .status-icon-wrapper {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      
      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
      }
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem;
    }
    
    p {
      color: #64748b;
      margin: 0;
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
  `]
})
export class ClubStripeOnboardingRefreshComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    // Auto-redirect to new onboarding link
    this.getNewLink();
  }

  getNewLink(): void {
    this.clubService.getStripeOnboardingLink()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (isPlatformBrowser(this.platformId)) {
            window.location.href = response.url;
          }
        }
      });
  }
}
