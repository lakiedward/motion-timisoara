import { CommonModule } from '@angular/common';
import { Component, Inject, inject, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminApiService } from '../../services/admin-api.service';
import { ChildAttendancePayment, SessionAttendance } from '../../services/admin-api.service';
import { animate, style, transition, trigger } from '@angular/animations';

export interface AttendanceModalData {
  session?: SessionAttendance;
}

interface ChildWithState extends ChildAttendancePayment {
  present: boolean;
  showPaymentInput?: boolean;
}

type FilterType = 'all' | 'low-sessions';

@Component({
  selector: 'app-attendance-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="attendance-modal">
      <!-- Hero Header -->
      <header class="modal-hero">
        <button
          mat-icon-button
          type="button"
          class="close-btn"
          aria-label="Închide"
          (click)="cancel()"
          [disabled]="isSaving()">
          <mat-icon>close</mat-icon>
        </button>
        <div class="hero-content">
          <span class="badge">Prezențe</span>
          <h1 class="hero-title">{{ data.session?.courseName }}</h1>
          <div class="hero-meta">
            <span class="meta-chip">
              <mat-icon>calendar_today</mat-icon>
              {{ data.session?.startsAt | date:'EEEE, d MMMM' }}
            </span>
            <span class="meta-chip">
              <mat-icon>schedule</mat-icon>
              {{ data.session?.startsAt | date:'HH:mm' }}
            </span>
            <span class="meta-chip meta-chip--highlight">
              <mat-icon>group</mat-icon>
              {{ allChildren().length }} participanți
            </span>
          </div>
        </div>
      </header>

      <!-- Stats & Actions Bar -->
      <div class="action-bar">
        <div class="stats-row">
          <button class="stat-card" [class.stat-card--active]="currentFilter() === 'all'" (click)="setFilter('all')">
            <div class="stat-icon stat-icon--blue"><mat-icon>groups</mat-icon></div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().total }}</span>
              <span class="stat-label">Total</span>
            </div>
          </button>
          <div class="stat-card stat-card--success">
            <div class="stat-icon stat-icon--green"><mat-icon>check_circle</mat-icon></div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().present }}</span>
              <span class="stat-label">Prezenți</span>
            </div>
          </div>
          <button class="stat-card" [class.stat-card--active]="currentFilter() === 'low-sessions'" (click)="setFilter('low-sessions')">
            <div class="stat-icon stat-icon--amber"><mat-icon>warning</mat-icon></div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().lowSessions }}</span>
              <span class="stat-label">Atenție</span>
            </div>
          </button>
        </div>
        <div class="quick-actions">
          <button class="action-btn action-btn--success" (click)="markAllPresent()" [disabled]="isSaving()">
            <mat-icon>how_to_reg</mat-icon>
            <span>Toți Prezenți</span>
            <kbd>P</kbd>
          </button>
          <button class="action-btn action-btn--outline" (click)="markAllAbsent()" [disabled]="isSaving()">
            <mat-icon>person_off</mat-icon>
            <span>Toți Absenți</span>
            <kbd>A</kbd>
          </button>
        </div>
      </div>

      <!-- Children List -->
      <div class="modal-content">
        <div class="section-card" *ngIf="children().length > 0; else emptyState">
          <div class="section-header">
            <h2 class="section-title"><mat-icon>people</mat-icon> Lista Participanți</h2>
            <span class="section-count">{{ children().length }}</span>
          </div>
          
          <div class="children-grid">
            <div *ngFor="let child of children(); trackBy: trackByChild"
                 class="child-row"
                 [class.child-row--present]="child.present"
                 [class.child-row--warning]="child.lowSessionWarning">
              
              <!-- Toggle & Info -->
              <div class="child-main" (click)="togglePresence(child)">
                <div class="toggle-circle" [class.toggle-circle--active]="child.present">
                  <mat-icon>{{ child.present ? 'check' : 'close' }}</mat-icon>
                </div>
                <div class="child-details">
                  <span class="child-name">{{ child.childName }}</span>
                  <span class="child-status" [class.child-status--present]="child.present">
                    {{ child.present ? 'Prezent' : 'Absent' }}
                  </span>
                </div>
              </div>

              <!-- Sessions Info -->
              <div class="sessions-info">
                <div class="session-stat" [class.session-stat--warning]="child.lowSessionWarning">
                  <span class="session-value">{{ child.remainingSessions }}</span>
                  <span class="session-label">rămase</span>
                </div>
                <div class="session-stat">
                  <span class="session-value">{{ child.sessionsUsed }}</span>
                  <span class="session-label">folosite</span>
                </div>
              </div>

              <!-- Add Sessions -->
              <button class="add-btn" (click)="child.showPaymentInput = !child.showPaymentInput" [disabled]="isSaving()">
                <mat-icon>{{ child.showPaymentInput ? 'expand_less' : 'add_circle' }}</mat-icon>
              </button>

              <!-- Expandable Payment -->
              <div class="payment-panel" *ngIf="child.showPaymentInput" [@slideDown]>
                <div class="payment-grid">
                  <button class="quick-btn" (click)="addSessions(child, 5)" [disabled]="isSaving()">+5</button>
                  <button class="quick-btn" (click)="addSessions(child, 10)" [disabled]="isSaving()">+10</button>
                  <button class="quick-btn" (click)="addSessions(child, 15)" [disabled]="isSaving()">+15</button>
                  <div class="custom-input">
                    <input type="number" min="1" placeholder="Nr." #customInput (keyup.enter)="addSessions(child, +customInput.value); customInput.value = ''">
                    <button class="confirm-btn" (click)="addSessions(child, +customInput.value); customInput.value = ''" [disabled]="isSaving() || !customInput.value">
                      <mat-icon>check</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="empty-state">
            <mat-icon>group_off</mat-icon>
            <h3>Niciun participant</h3>
            <p>Nu există copii înscriși la această sesiune</p>
          </div>
        </ng-template>
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <button class="btn-secondary" (click)="cancel()" [disabled]="isSaving()">Anulează</button>
        <button class="btn-primary" (click)="save()" [disabled]="isSaving()">
          <mat-spinner *ngIf="isSaving()" diameter="18"></mat-spinner>
          <mat-icon *ngIf="!isSaving()">save</mat-icon>
          <span>{{ isSaving() ? 'Se salvează...' : 'Salvează' }}</span>
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      --primary: #2563eb;
      --primary-dark: #1e40af;
      --success: #10b981;
      --success-light: #ecfdf5;
      --warning: #f59e0b;
      --warning-light: #fffbeb;
      --danger: #ef4444;
      --text-dark: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --bg-subtle: #f8fafc;
      --radius: 16px;
      --radius-sm: 12px;
    }

    .attendance-modal {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 90vh;
      max-height: 900px;
      background: var(--bg-subtle);
      overflow: hidden;
    }

    /* ==================== HERO HEADER ==================== */
    .modal-hero {
      position: relative;
      isolation: isolate;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
      padding: 1.5rem 2rem 2rem;
      color: white;
      flex-shrink: 0;
    }

    .modal-hero::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 40%;
      height: 100%;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='80' fill='rgba(255,255,255,0.08)'/%3E%3Ccircle cx='150' cy='50' r='40' fill='rgba(255,255,255,0.05)'/%3E%3C/svg%3E") no-repeat center right;
      pointer-events: none;
      z-index: 0;
    }

    .close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.15);
      border: none;
      border-radius: 50%;
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      z-index: 3;
    }
    .close-btn:hover { background: rgba(255,255,255,0.25); }
    .close-btn mat-icon { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }

    .hero-content { position: relative; z-index: 1; }

    .badge {
      display: inline-block;
      padding: 0.375rem 0.875rem;
      background: rgba(255,255,255,0.2);
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    .hero-title {
      margin: 0 0 1rem;
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1.2;
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.875rem;
      background: rgba(255,255,255,0.15);
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .meta-chip mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
    .meta-chip--highlight { background: rgba(16,185,129,0.3); }

    /* ==================== ACTION BAR ==================== */
    .action-bar {
      background: white;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: var(--bg-subtle);
      border: 2px solid transparent;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s;
    }
    .stat-card:hover { border-color: var(--border); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .stat-card--active { background: #eff6ff; border-color: var(--primary); }
    .stat-card--success { cursor: default; background: var(--success-light); }
    .stat-card--success:hover { transform: none; box-shadow: none; }

    .stat-icon {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      flex-shrink: 0;
    }
    .stat-icon mat-icon { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }
    .stat-icon--blue { background: #dbeafe; color: #2563eb; }
    .stat-icon--green { background: #d1fae5; color: #059669; }
    .stat-icon--amber { background: #fef3c7; color: #d97706; }

    .stat-info { display: flex; flex-direction: column; gap: 0.125rem; }
    .stat-value { font-size: 1.5rem; font-weight: 800; color: var(--text-dark); line-height: 1; }
    .stat-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }

    .quick-actions { display: flex; gap: 0.75rem; }

    .action-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.875rem;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }
    .action-btn mat-icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; }
    .action-btn kbd {
      padding: 0.125rem 0.375rem;
      background: rgba(0,0,0,0.08);
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      font-family: monospace;
    }

    .action-btn--success {
      background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(16,185,129,0.3);
    }
    .action-btn--success:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16,185,129,0.4); }
    .action-btn--success kbd { background: rgba(255,255,255,0.2); color: white; }

    .action-btn--outline {
      background: white;
      border-color: var(--border);
      color: var(--text-muted);
    }
    .action-btn--outline:hover { border-color: var(--text-muted); color: var(--text-dark); }

    /* ==================== CONTENT ==================== */
    .modal-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .section-card {
      background: white;
      border-radius: var(--radius);
      box-shadow: 0 4px 20px rgba(15,23,42,0.08);
      overflow: hidden;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-dark);
    }
    .section-title mat-icon { color: var(--primary); font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }

    .section-count {
      padding: 0.25rem 0.75rem;
      background: #eff6ff;
      color: var(--primary);
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .children-grid { display: flex; flex-direction: column; }

    .child-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      transition: background 0.2s;
    }
    .child-row:last-child { border-bottom: none; }
    .child-row:hover { background: var(--bg-subtle); }
    .child-row--present { background: linear-gradient(90deg, var(--success-light) 0%, white 30%); }
    .child-row--warning { background: linear-gradient(90deg, var(--warning-light) 0%, white 30%); }

    .child-main {
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
    }

    .toggle-circle {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #f1f5f9;
      color: #94a3b8;
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      flex-shrink: 0;
    }
    .toggle-circle mat-icon { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }
    .toggle-circle--active {
      background: var(--success);
      color: white;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(16,185,129,0.4);
    }

    .child-details { display: flex; flex-direction: column; gap: 0.25rem; }
    .child-name { font-weight: 700; font-size: 0.95rem; color: var(--text-dark); }
    .child-status { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
    .child-status--present { color: var(--success); }

    .sessions-info { display: flex; gap: 1.5rem; }

    .session-stat { display: flex; flex-direction: column; align-items: center; gap: 0.125rem; }
    .session-value { font-size: 1.25rem; font-weight: 800; color: var(--text-dark); }
    .session-label { font-size: 0.65rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
    .session-stat--warning .session-value { color: var(--danger); }

    .add-btn {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eff6ff;
      border: none;
      border-radius: 8px;
      color: var(--primary);
      cursor: pointer;
      transition: all 0.2s;
    }
    .add-btn:hover { background: #dbeafe; }
    .add-btn mat-icon { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }

    .payment-panel {
      grid-column: 1 / -1;
      padding: 1rem 0 0;
      border-top: 1px dashed var(--border);
      margin-top: 0.75rem;
    }

    .payment-grid {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .quick-btn {
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .quick-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }

    .custom-input {
      display: flex;
      gap: 0.25rem;
      flex: 1;
      min-width: 120px;
    }
    .custom-input input {
      width: 60px;
      padding: 0.5rem 0.75rem;
      border: 2px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .custom-input input:focus { outline: none; border-color: var(--primary); }

    .confirm-btn {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--success);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .confirm-btn mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }
    .empty-state mat-icon { font-size: 4rem; width: 4rem; height: 4rem; color: #cbd5e1; margin-bottom: 1rem; }
    .empty-state h3 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 700; color: var(--text-dark); }
    .empty-state p { margin: 0; color: var(--text-muted); }

    /* ==================== FOOTER ==================== */
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      background: white;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .btn-secondary, .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: white;
      border: 2px solid var(--border);
      color: var(--text-muted);
    }
    .btn-secondary:hover { border-color: var(--text-muted); color: var(--text-dark); }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%);
      border: none;
      color: white;
      box-shadow: 0 4px 12px rgba(37,99,235,0.3);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,0.4); }
    .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .btn-primary mat-icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; }

    mat-spinner { display: inline-block; }

    /* ==================== RESPONSIVE ==================== */
    @media (max-width: 768px) {
      .attendance-modal { height: 100vh; max-height: 100vh; }
      .modal-hero { padding: 1.25rem 1.25rem 1.5rem; }
      .hero-title { font-size: 1.375rem; }
      .hero-meta { gap: 0.5rem; }
      .meta-chip { padding: 0.375rem 0.625rem; font-size: 0.7rem; }

      .action-bar { padding: 1rem; }
      .stats-row { gap: 0.5rem; }
      .stat-card { padding: 0.625rem 0.75rem; gap: 0.5rem; }
      .stat-icon { width: 2rem; height: 2rem; }
      .stat-value { font-size: 1.25rem; }
      .stat-label { font-size: 0.6rem; }

      .quick-actions { flex-direction: column; gap: 0.5rem; }
      .action-btn span { display: none; }

      .modal-content { padding: 1rem; }
      .child-row { grid-template-columns: 1fr auto; padding: 0.875rem 1rem; gap: 0.75rem; }
      .sessions-info { display: none; }
      .toggle-circle { width: 2.25rem; height: 2.25rem; }

      .modal-footer { flex-direction: column-reverse; padding: 1rem; }
      .btn-secondary, .btn-primary { width: 100%; justify-content: center; }
    }

    @media (max-width: 480px) {
      .modal-hero { padding: 1rem; }
      .close-btn { top: 0.75rem; right: 0.75rem; width: 2rem; height: 2rem; }
      .hero-title { font-size: 1.125rem; }
      .badge { font-size: 0.65rem; padding: 0.25rem 0.625rem; }
      .stat-card { flex-direction: column; text-align: center; padding: 0.5rem; }
      .stat-icon { margin: 0 auto; }
    }
  `],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0 }),
        animate('200ms ease-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ height: 0, opacity: 0 }))
      ])
    ])
  ]
})
export class AttendanceModalComponent {
  private readonly snackbar = inject(MatSnackBar);
  private readonly api = inject(AdminApiService);
  
  readonly allChildren = signal<ChildWithState[]>([]);
  readonly currentFilter = signal<FilterType>('all');
  readonly isSaving = signal(false);

  // Computed statistics
  readonly stats = computed(() => {
    const children = this.allChildren();
    return {
      total: children.length,
      present: children.filter(c => c.present).length,
      lowSessions: children.filter(c => c.lowSessionWarning).length
    };
  });

  // Filtered and sorted children
  readonly children = computed(() => {
    let children = [...this.allChildren()];
    const filter = this.currentFilter();

    if (filter === 'low-sessions') {
      children = children.filter(c => c.lowSessionWarning);
    }

    // Sort: Warning first, then by name
    return children.sort((a, b) => {
      if (a.lowSessionWarning && !b.lowSessionWarning) return -1;
      if (!a.lowSessionWarning && b.lowSessionWarning) return 1;
      return a.childName.localeCompare(b.childName);
    });
  });

  constructor(
    private dialogRef: MatDialogRef<AttendanceModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AttendanceModalData
  ) {
    const rawChildren = data.session?.children ?? [];
    const childrenWithState: ChildWithState[] = rawChildren.map(child => ({
      ...child,
      present: child.attendanceStatus === 'PRESENT',
      showPaymentInput: false
    }));
    this.allChildren.set(childrenWithState);
  }

  // Public method to refresh session data while dialog is open
  // Keeps current presence toggles, updates remaining/used sessions and warnings
  refreshSession(session: SessionAttendance): void {
    const current = this.allChildren();
    const updatedMap = new Map(session.children.map(c => [c.enrollmentId, c]));
    const merged: ChildWithState[] = current.map(child => {
      const update = updatedMap.get(child.enrollmentId);
      if (!update) return child;
      return {
        ...child,
        remainingSessions: update.remainingSessions,
        sessionsUsed: update.sessionsUsed,
        lowSessionWarning: update.lowSessionWarning
      };
    });
    this.allChildren.set(merged);
  }

  // Keyboard shortcuts
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch(event.key.toLowerCase()) {
      case 'a':
        event.preventDefault();
        this.markAllAbsent();
        break;
      case 'p':
        event.preventDefault();
        this.markAllPresent();
        break;
    }
  }

  setFilter(filter: FilterType): void {
    this.currentFilter.set(filter);
  }

  togglePresence(child: ChildWithState): void {
    child.present = !child.present;
    this.allChildren.set([...this.allChildren()]);
  }

  markAllPresent(): void {
    const children = this.allChildren();
    children.forEach(child => child.present = true);
    this.allChildren.set([...children]);
    this.snackbar.open('✓ Toți copiii marcați prezenți', undefined, { duration: 2000 });
  }

  markAllAbsent(): void {
    const children = this.allChildren();
    children.forEach(child => child.present = false);
    this.allChildren.set([...children]);
    this.snackbar.open('✓ Toți copiii marcați absenți', undefined, { duration: 2000 });
  }

  addSessions(child: ChildWithState, count: number): void {
    if (!count || count <= 0) return;
    this.dialogRef.close({ action: 'addSessions', child, count });
  }

  save(): void {
    this.isSaving.set(true);
    this.dialogRef.close({ children: this.allChildren(), action: 'save' });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  trackByChild(index: number, child: ChildWithState): string {
    return child.enrollmentId;
  }
}
