import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DeleteChildDialogData {
  childName: string;
  activeEnrollmentsCount: number;
}

@Component({
  selector: 'app-delete-child-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="premium-delete-dialog">
      <!-- Header Section -->
      <div class="dialog-header">
        <div class="icon-container">
          <mat-icon class="warning-icon">warning_amber</mat-icon>
        </div>
        <div class="header-content">
          <h2 mat-dialog-title>Șterge profilul?</h2>
          <p class="header-subtitle">{{ data.childName }}</p>
        </div>
      </div>
      
      <mat-dialog-content class="dialog-content">
        <!-- Active Enrollments Warning -->
        <div class="info-card warning-card" *ngIf="data.activeEnrollmentsCount > 0">
          <div class="card-icon-badge">
            <mat-icon class="icon-colored">error_outline</mat-icon>
          </div>
          <div class="card-content">
            <h3 class="card-title">{{ data.activeEnrollmentsCount }} {{ data.activeEnrollmentsCount === 1 ? 'înscriere activă' : 'înscrieri active' }}</h3>
            <p class="card-description">Ștergerea va anula automat toate înscrierile și va elimina:</p>
            <ul class="impact-list">
              <li><mat-icon class="list-icon">cancel</mat-icon><span>Înscrierile la cursuri și tabere</span></li>
              <li><mat-icon class="list-icon">receipt_long</mat-icon><span>Istoricul de plăți</span></li>
              <li><mat-icon class="list-icon">event_available</mat-icon><span>Prezențele înregistrate</span></li>
            </ul>
          </div>
        </div>
        
        <!-- No Enrollments Message -->
        <div class="info-card neutral-card" *ngIf="data.activeEnrollmentsCount === 0">
          <div class="card-icon-badge">
            <mat-icon class="icon-colored">info_outline</mat-icon>
          </div>
          <div class="card-content">
            <p class="card-description">Confirmă ștergerea profilului pentru <strong>{{ data.childName }}</strong>.</p>
          </div>
        </div>
        
        <!-- Irreversible Action Notice -->
        <div class="alert-banner">
          <mat-icon class="icon-colored">lock</mat-icon>
          <span>Această acțiune este <strong>ireversibilă</strong></span>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-btn">
          <mat-icon>arrow_back</mat-icon>
          <span class="btn-text">Renunță</span>
        </button>
        <button mat-flat-button (click)="onConfirm()" class="delete-btn">
          <mat-icon>delete_forever</mat-icon>
          <span class="btn-text">Confirmă</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    /* ============================================
       PREMIUM VARIABLES & ICON FIXES
       ============================================ */
    :host {
      --blue-50: #eff6ff;
      --blue-100: #dbeafe;
      --blue-200: #bfdbfe;
      --blue-500: #3b82f6;
      --blue-600: #2563eb;
      --blue-700: #1d4ed8;
      --orange-50: #fff7ed;
      --orange-100: #ffedd5;
      --orange-500: #f97316;
      --orange-600: #ea580c;
      --red-500: #ef4444;
      --red-600: #dc2626;
      --radius-sm: 12px;
      --radius-md: 16px;
      --radius-lg: 20px;
    }
    
    /* Force Material Icons to display */
    .icon-colored {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    
    .list-icon {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    /* ============================================
       DIALOG CONTAINER OVERRIDE - MOBILE POSITIONING FIX
       ============================================ */
    :host ::ng-deep .mat-mdc-dialog-container {
      background: rgba(255, 255, 255, 0.98) !important;
      backdrop-filter: blur(24px) !important;
      -webkit-backdrop-filter: blur(24px) !important;
      border-radius: 24px !important;
      box-shadow: 
        0 24px 80px rgba(15, 23, 42, 0.12),
        0 12px 40px rgba(59, 130, 246, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 1) !important;
      border: 1px solid rgba(191, 219, 254, 0.3) !important;
      overflow: visible !important;
      padding: 0 !important;
      max-height: 90vh !important;
      overflow-y: auto !important;
      
      @media (max-width: 640px) {
        max-height: calc(100vh - 120px) !important;
        margin-top: 60px !important;
        border-radius: 20px !important;
      }
    }
    
    /* Dialog positioning wrapper - push down on mobile */
    :host ::ng-deep .cdk-overlay-pane {
      @media (max-width: 640px) {
        align-items: flex-start !important;
        padding-top: 80px !important;
      }
    }
    
    /* ============================================
       MAIN DIALOG - RESPONSIVE
       ============================================ */
    .premium-delete-dialog {
      min-width: 540px;
      max-width: 600px;
      padding: 2.5rem;
      box-sizing: border-box;
      
      @media (max-width: 768px) {
        min-width: 420px;
        padding: 2rem 1.75rem;
      }
      
      @media (max-width: 640px) {
        min-width: auto;
        max-width: 100%;
        width: calc(100vw - 2rem);
        padding: 1.5rem 1.25rem;
      }
      
      @media (max-width: 480px) {
        padding: 1.25rem 1rem;
      }
    }
    
    /* ============================================
       HEADER SECTION - RESPONSIVE
       ============================================ */
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
      animation: fadeInDown 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      
      @media (max-width: 640px) {
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
    }
    
    .icon-container {
      position: relative;
      flex-shrink: 0;
      
      &::before {
        content: '';
        position: absolute;
        inset: -8px;
        background: linear-gradient(135deg, var(--orange-100) 0%, var(--orange-50) 100%);
        border-radius: 50%;
        opacity: 0.6;
        animation: pulse 2.5s ease-in-out infinite;
        
        @media (max-width: 640px) {
          inset: -6px;
        }
      }
    }
    
    .warning-icon {
      position: relative;
      font-size: 3rem !important;
      width: 3rem !important;
      height: 3rem !important;
      color: var(--orange-600);
      background: linear-gradient(135deg, var(--orange-50) 0%, #ffffff 100%);
      border-radius: 50%;
      padding: 0.875rem;
      display: flex !important;
      align-items: center;
      justify-content: center;
      box-shadow: 
        0 8px 24px rgba(249, 115, 22, 0.25),
        inset 0 2px 4px rgba(255, 255, 255, 0.8);
      border: 2px solid var(--orange-100);
      
      @media (max-width: 640px) {
        font-size: 2.25rem !important;
        width: 2.25rem !important;
        height: 2.25rem !important;
        padding: 0.625rem;
      }
    }
    
    .header-content {
      flex: 1;
      min-width: 0;
      
      h2 {
        margin: 0 0 0.375rem;
        font-size: 1.75rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.02em;
        line-height: 1.2;
        
        @media (max-width: 640px) {
          font-size: 1.375rem;
          margin-bottom: 0.25rem;
        }
      }
      
      .header-subtitle {
        margin: 0;
        font-size: 1.0625rem;
        font-weight: 600;
        color: var(--blue-600);
        letter-spacing: -0.01em;
        word-wrap: break-word;
        
        @media (max-width: 640px) {
          font-size: 0.9375rem;
        }
      }
    }
    
    /* ============================================
       DIALOG CONTENT
       ============================================ */
    .dialog-content {
      padding: 0 !important;
      animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s backwards;
    }
    
    /* ============================================
       INFO CARDS - RESPONSIVE
       ============================================ */
    .info-card {
      display: flex;
      gap: 1.25rem;
      padding: 1.75rem;
      border-radius: var(--radius-md);
      margin-bottom: 1.5rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-sizing: border-box;
      border: 2px solid transparent;
      
      @media (max-width: 640px) {
        gap: 1rem;
        padding: 1.25rem;
        margin-bottom: 1.25rem;
        border-radius: var(--radius-sm);
      }
      
      @media (max-width: 480px) {
        padding: 1rem;
        flex-direction: column;
        align-items: flex-start;
      }
    }
    
    .warning-card {
      background: linear-gradient(135deg, var(--orange-50) 0%, #fff7ed 50%, #fffbeb 100%);
      border-color: rgba(249, 115, 22, 0.2);
      box-shadow: 
        0 4px 16px rgba(249, 115, 22, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    
    .neutral-card {
      background: linear-gradient(135deg, var(--blue-50) 0%, #f8fafc 100%);
      border-color: rgba(59, 130, 246, 0.2);
      box-shadow: 
        0 4px 16px rgba(59, 130, 246, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    
    .card-icon-badge {
      flex-shrink: 0;
      
      mat-icon {
        font-size: 2rem !important;
        width: 2rem !important;
        height: 2rem !important;
        display: flex !important;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 12px;
        padding: 0.625rem;
        box-shadow: 
          0 4px 12px rgba(15, 23, 42, 0.08),
          inset 0 1px 2px rgba(255, 255, 255, 1);
        
        @media (max-width: 640px) {
          font-size: 1.5rem !important;
          width: 1.5rem !important;
          height: 1.5rem !important;
          padding: 0.5rem;
        }
      }
    }
    
    .warning-card .card-icon-badge mat-icon {
      color: var(--orange-600);
      border: 2px solid var(--orange-100);
    }
    
    .neutral-card .card-icon-badge mat-icon {
      color: var(--blue-600);
      border: 2px solid var(--blue-100);
    }
    
    .card-content {
      flex: 1;
      min-width: 0;
    }
    
    .card-title {
      margin: 0 0 0.75rem;
      font-size: 1.125rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
      
      @media (max-width: 640px) {
        font-size: 1rem;
        margin-bottom: 0.5rem;
      }
    }
    
    .card-description {
      margin: 0 0 1rem;
      font-size: 0.9375rem;
      line-height: 1.6;
      color: #475569;
      font-weight: 500;
      
      @media (max-width: 640px) {
        font-size: 0.875rem;
        margin-bottom: 0.875rem;
      }
      
      strong {
        color: #0f172a;
        font-weight: 700;
      }
    }
    
    .impact-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      
      @media (max-width: 640px) {
        gap: 0.625rem;
      }
      
      li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9375rem;
        color: #334155;
        font-weight: 500;
        padding: 0.625rem 0.875rem;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 10px;
        border: 1px solid rgba(249, 115, 22, 0.1);
        transition: all 0.2s ease;
        
        @media (max-width: 640px) {
          font-size: 0.875rem;
          padding: 0.5rem 0.75rem;
          gap: 0.625rem;
        }
        
        &:hover {
          background: rgba(255, 255, 255, 0.95);
          transform: translateX(4px);
        }
        
        mat-icon {
          font-size: 1.25rem !important;
          width: 1.25rem !important;
          height: 1.25rem !important;
          color: var(--orange-500);
          flex-shrink: 0;
          display: inline-flex !important;
          
          @media (max-width: 640px) {
            font-size: 1.125rem !important;
            width: 1.125rem !important;
            height: 1.125rem !important;
          }
        }
        
        span {
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
        }
      }
    }
    
    /* ============================================
       ALERT BANNER - RESPONSIVE
       ============================================ */
    .alert-banner {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1rem 1.25rem;
      background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);
      border-radius: var(--radius-sm);
      border: 2px solid rgba(239, 68, 68, 0.15);
      margin-bottom: 0.5rem;
      box-shadow: 
        0 2px 8px rgba(239, 68, 68, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      
      @media (max-width: 640px) {
        gap: 0.75rem;
        padding: 0.875rem 1rem;
      }
      
      mat-icon {
        font-size: 1.25rem !important;
        width: 1.25rem !important;
        height: 1.25rem !important;
        color: var(--red-600);
        flex-shrink: 0;
        display: inline-flex !important;
        
        @media (max-width: 640px) {
          font-size: 1.125rem !important;
          width: 1.125rem !important;
          height: 1.125rem !important;
        }
      }
      
      span {
        font-size: 0.9375rem;
        color: #7c2d12;
        font-weight: 600;
        
        @media (max-width: 640px) {
          font-size: 0.8125rem;
        }
        
        strong {
          font-weight: 800;
          color: var(--red-600);
        }
      }
    }
    
    /* ============================================
       DIALOG ACTIONS - RESPONSIVE
       ============================================ */
    .dialog-actions {
      padding: 2rem 0 0 !important;
      margin: 0 !important;
      justify-content: flex-end;
      gap: 1rem;
      border-top: 2px solid rgba(15, 23, 42, 0.06);
      animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s backwards;
      
      @media (max-width: 640px) {
        padding: 1.5rem 0 0 !important;
        gap: 0.75rem;
        flex-direction: column-reverse;
      }
      
      button {
        min-width: 150px;
        height: 52px;
        font-weight: 700;
        font-size: 0.9375rem;
        letter-spacing: 0.01em;
        border-radius: var(--radius-sm) !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.625rem;
        
        @media (max-width: 640px) {
          width: 100%;
          min-width: 100%;
          height: 48px;
          font-size: 0.875rem;
        }
        
        mat-icon {
          font-size: 1.25rem !important;
          width: 1.25rem !important;
          height: 1.25rem !important;
          transition: transform 0.3s ease;
          display: inline-flex !important;
          
          @media (max-width: 640px) {
            font-size: 1.125rem !important;
            width: 1.125rem !important;
            height: 1.125rem !important;
          }
        }
        
        .btn-text {
          @media (max-width: 480px) {
            font-size: 0.875rem;
          }
        }
        
        &:hover mat-icon {
          transform: scale(1.15);
        }
        
        &:active {
          transform: scale(0.97);
          transition-duration: 0.1s !important;
        }
      }
    }
    
    .cancel-btn {
      border: 2px solid var(--blue-200) !important;
      color: #475569 !important;
      background: rgba(248, 250, 252, 0.8) !important;
      
      &:hover {
        background: #ffffff !important;
        border-color: var(--blue-500) !important;
        color: var(--blue-700) !important;
        transform: translateY(-2px);
        box-shadow: 
          0 6px 16px rgba(59, 130, 246, 0.12),
          0 2px 8px rgba(59, 130, 246, 0.08) !important;
        
        mat-icon {
          transform: translateX(-3px) scale(1.15);
        }
      }
    }
    
    .delete-btn {
      background: linear-gradient(135deg, var(--red-600) 0%, var(--red-500) 100%) !important;
      color: #ffffff !important;
      box-shadow: 
        0 6px 20px rgba(220, 38, 38, 0.3),
        0 2px 8px rgba(220, 38, 38, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      
      &:hover {
        background: linear-gradient(135deg, #b91c1c 0%, var(--red-600) 100%) !important;
        transform: translateY(-3px);
        box-shadow: 
          0 12px 32px rgba(220, 38, 38, 0.35),
          0 6px 16px rgba(220, 38, 38, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
      }
    }
    
    /* ============================================
       ANIMATIONS
       ============================================ */
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 0.6;
      }
      50% {
        transform: scale(1.15);
        opacity: 0.8;
      }
    }
  `]
})
export class DeleteChildDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DeleteChildDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteChildDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

