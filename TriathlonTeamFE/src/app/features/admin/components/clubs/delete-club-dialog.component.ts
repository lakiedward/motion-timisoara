import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DeleteClubDialogData {
  clubName: string;
  coachCount: number;
  courseCount: number;
}

export interface DeleteClubDialogResult {
  confirmed: boolean;
}

@Component({
  selector: 'app-delete-club-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="premium-delete-dialog">
      <!-- Header Section -->
      <div class="dialog-header">
        <div class="icon-container" [class.has-dependencies]="hasDependencies">
          <mat-icon class="warning-icon">{{ hasDependencies ? 'warning' : 'business_center' }}</mat-icon>
        </div>
        <div class="header-content">
          <h2 mat-dialog-title>{{ hasDependencies ? 'Ștergere cu dependențe' : 'Șterge clubul?' }}</h2>
          <p class="header-subtitle">{{ data.clubName }}</p>
        </div>
      </div>
      
      <mat-dialog-content class="dialog-content">
        <!-- Has Dependencies Warning -->
        <div class="info-card danger-card" *ngIf="hasDependencies">
          <div class="card-icon-badge">
            <mat-icon>error_outline</mat-icon>
          </div>
          <div class="card-content">
            <h3 class="card-title">Acest club are asocieri active</h3>
            <p class="card-description">Ștergerea va afecta următoarele:</p>
            <ul class="impact-list">
              <li *ngIf="data.coachCount > 0">
                <mat-icon>person</mat-icon>
                <span>{{ data.coachCount }} {{ data.coachCount === 1 ? 'antrenor va fi dezasociat' : 'antrenori vor fi dezasociați' }}</span>
              </li>
              <li *ngIf="data.courseCount > 0">
                <mat-icon>school</mat-icon>
                <span>{{ data.courseCount }} {{ data.courseCount === 1 ? 'curs va fi dezasociat' : 'cursuri vor fi dezasociate' }}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <!-- No Dependencies Message -->
        <div class="info-card warning-card" *ngIf="!hasDependencies">
          <div class="card-icon-badge">
            <mat-icon>info_outline</mat-icon>
          </div>
          <div class="card-content">
            <p class="card-description">Confirmă ștergerea clubului <strong>{{ data.clubName }}</strong>.</p>
            <p class="card-note">Clubul nu are antrenori sau cursuri asociate.</p>
          </div>
        </div>
        
        <!-- Irreversible Action Notice -->
        <div class="alert-banner" [class.danger-banner]="hasDependencies">
          <mat-icon>{{ hasDependencies ? 'dangerous' : 'lock' }}</mat-icon>
          <span>Această acțiune este <strong>ireversibilă</strong></span>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-btn">
          <mat-icon>arrow_back</mat-icon>
          <span>Renunță</span>
        </button>
        <button mat-flat-button (click)="onConfirm()" class="delete-btn" [class.force-btn]="hasDependencies">
          <mat-icon>{{ hasDependencies ? 'delete_forever' : 'delete' }}</mat-icon>
          <span>{{ hasDependencies ? 'Șterge oricum' : 'Confirmă' }}</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      --amber-50: #fffbeb;
      --amber-100: #fef3c7;
      --amber-500: #f59e0b;
      --amber-600: #d97706;
      --red-50: #fef2f2;
      --red-100: #fee2e2;
      --red-500: #ef4444;
      --red-600: #dc2626;
      --blue-50: #eff6ff;
      --blue-100: #dbeafe;
      --blue-500: #3b82f6;
      --blue-600: #2563eb;
      --radius-sm: 12px;
      --radius-md: 16px;
    }

    :host ::ng-deep .mat-mdc-dialog-container {
      background: rgba(255, 255, 255, 0.98) !important;
      backdrop-filter: blur(24px) !important;
      border-radius: 24px !important;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12) !important;
      border: 1px solid rgba(245, 158, 11, 0.2) !important;
      padding: 0 !important;
      max-height: 90vh !important;
      overflow-y: auto !important;
    }

    .premium-delete-dialog {
      min-width: 480px;
      max-width: 560px;
      padding: 2rem;
      
      @media (max-width: 640px) {
        min-width: auto;
        width: calc(100vw - 2rem);
        padding: 1.5rem;
      }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .icon-container {
      position: relative;
      flex-shrink: 0;
      
      &::before {
        content: '';
        position: absolute;
        inset: -6px;
        background: linear-gradient(135deg, var(--amber-100) 0%, var(--amber-50) 100%);
        border-radius: 50%;
        opacity: 0.7;
        animation: pulse 2s ease-in-out infinite;
      }
      
      &.has-dependencies::before {
        background: linear-gradient(135deg, var(--red-100) 0%, var(--red-50) 100%);
      }
    }

    .warning-icon {
      position: relative;
      font-size: 2.5rem !important;
      width: 2.5rem !important;
      height: 2.5rem !important;
      color: var(--amber-600);
      background: linear-gradient(135deg, var(--amber-50) 0%, #ffffff 100%);
      border-radius: 50%;
      padding: 0.75rem;
      display: flex !important;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.25);
      border: 2px solid var(--amber-100);
      
      .has-dependencies & {
        color: var(--red-600);
        background: linear-gradient(135deg, var(--red-50) 0%, #ffffff 100%);
        box-shadow: 0 6px 20px rgba(239, 68, 68, 0.25);
        border-color: var(--red-100);
      }
    }

    .header-content {
      flex: 1;
      
      h2 {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.02em;
      }
      
      .header-subtitle {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--amber-600);
      }
    }

    .dialog-content {
      padding: 0 !important;
    }

    .info-card {
      display: flex;
      gap: 1rem;
      padding: 1.25rem;
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
      border: 2px solid transparent;
    }

    .warning-card {
      background: linear-gradient(135deg, var(--amber-50) 0%, #fffbeb 100%);
      border-color: rgba(245, 158, 11, 0.2);
    }

    .danger-card {
      background: linear-gradient(135deg, var(--red-50) 0%, #fff5f5 100%);
      border-color: rgba(239, 68, 68, 0.2);
    }

    .card-icon-badge mat-icon {
      font-size: 1.75rem !important;
      width: 1.75rem !important;
      height: 1.75rem !important;
      padding: 0.5rem;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.9);
      
      .warning-card & {
        color: var(--amber-600);
        border: 2px solid var(--amber-100);
      }
      
      .danger-card & {
        color: var(--red-600);
        border: 2px solid var(--red-100);
      }
    }

    .card-title {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }

    .card-description {
      margin: 0;
      font-size: 0.9rem;
      color: #475569;
      font-weight: 500;
      
      strong {
        color: #0f172a;
        font-weight: 700;
      }
    }

    .card-note {
      margin: 0.5rem 0 0;
      font-size: 0.85rem;
      color: #64748b;
    }

    .impact-list {
      list-style: none;
      margin: 0.75rem 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      
      li {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        font-size: 0.875rem;
        color: #334155;
        font-weight: 500;
        padding: 0.5rem 0.75rem;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 8px;
        border: 1px solid rgba(239, 68, 68, 0.1);
        
        mat-icon {
          font-size: 1.125rem !important;
          width: 1.125rem !important;
          height: 1.125rem !important;
          color: var(--red-500);
        }
      }
    }

    .alert-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: linear-gradient(135deg, var(--amber-50) 0%, #fffbeb 100%);
      border-radius: var(--radius-sm);
      border: 2px solid rgba(245, 158, 11, 0.15);
      
      &.danger-banner {
        background: linear-gradient(135deg, var(--red-50) 0%, #fff5f5 100%);
        border-color: rgba(239, 68, 68, 0.2);
        
        mat-icon {
          color: var(--red-600);
        }
        
        span {
          color: #7c2d12;
          
          strong {
            color: var(--red-600);
          }
        }
      }
      
      mat-icon {
        font-size: 1.125rem !important;
        width: 1.125rem !important;
        height: 1.125rem !important;
        color: var(--amber-600);
      }
      
      span {
        font-size: 0.875rem;
        color: #92400e;
        font-weight: 600;
        
        strong {
          font-weight: 800;
          color: var(--amber-600);
        }
      }
    }

    .dialog-actions {
      padding: 1.5rem 0 0 !important;
      margin: 0 !important;
      justify-content: flex-end;
      gap: 0.75rem;
      border-top: 2px solid rgba(15, 23, 42, 0.06);
      
      @media (max-width: 640px) {
        flex-direction: column-reverse;
      }
      
      button {
        min-width: 140px;
        height: 48px;
        font-weight: 700;
        font-size: 0.9rem;
        border-radius: var(--radius-sm) !important;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: all 0.3s ease !important;
        
        @media (max-width: 640px) {
          width: 100%;
        }
        
        mat-icon {
          font-size: 1.125rem !important;
          width: 1.125rem !important;
          height: 1.125rem !important;
        }
      }
    }

    .cancel-btn {
      border: 2px solid var(--blue-100) !important;
      color: #475569 !important;
      background: rgba(248, 250, 252, 0.8) !important;
      
      &:hover {
        background: #ffffff !important;
        border-color: var(--blue-500) !important;
        color: var(--blue-600) !important;
        transform: translateY(-2px);
      }
    }

    .delete-btn {
      background: linear-gradient(135deg, var(--amber-500) 0%, var(--amber-600) 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3) !important;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4) !important;
      }
      
      &.force-btn {
        background: linear-gradient(135deg, var(--red-600) 0%, var(--red-500) 100%) !important;
        box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3) !important;
        
        &:hover {
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4) !important;
        }
      }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.1); opacity: 0.9; }
    }
  `]
})
export class DeleteClubDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DeleteClubDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteClubDialogData
  ) {}

  get hasDependencies(): boolean {
    return this.data.coachCount > 0 || this.data.courseCount > 0;
  }

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  onConfirm(): void {
    this.dialogRef.close({ confirmed: true });
  }
}
