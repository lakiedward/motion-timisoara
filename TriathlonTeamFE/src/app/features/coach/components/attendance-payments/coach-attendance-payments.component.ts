import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { CoachApiService, CoachPaymentReportRow, WeeklyCalendar } from '../../services/coach-api.service';
import { CoachPendingPaymentsService } from '../../services/coach-pending-payments.service';
import { AttendanceModalComponent, AttendanceModalData } from '../../../admin/components/attendance-payments/attendance-modal.component';
import { ProductLabelPipe } from '../../../../shared/pipes/product-label.pipe';

@Component({
  selector: 'app-coach-attendance-payments',
  standalone: true,
  providers: [CoachPendingPaymentsService],
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    MatRippleModule,
    ProductLabelPipe
  ],
  templateUrl: './coach-attendance-payments.component.html',
  styleUrls: ['./coach-attendance-payments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachAttendancePaymentsComponent implements OnInit {
  private readonly api = inject(CoachApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly coachPayments = inject(CoachPendingPaymentsService);

  readonly calendar = signal<WeeklyCalendar | null>(null);
  readonly isLoading = signal(false);
  readonly currentWeekStart = signal<Date>(this.getMonday(new Date()));

  readonly shouldShowPendingPaymentsSection = computed(
    () =>
      this.coachPayments.pendingPayments().length > 0 ||
      this.coachPayments.isLoadingPayments() ||
      this.coachPayments.isPaymentsError()
  );

  // Stats helpers
  getTotalSessions(): number {
    const cal = this.calendar();
    if (!cal?.coaches) return 0;
    return cal.coaches.reduce((sum, coach) => 
      sum + coach.days.reduce((daySum, day) => daySum + day.sessions.length, 0), 0);
  }

  getTotalEnrolled(): number {
    const cal = this.calendar();
    if (!cal?.coaches) return 0;
    return cal.coaches.reduce((sum, coach) => 
      sum + coach.days.reduce((daySum, day) => 
        daySum + day.sessions.reduce((sessSum, sess) => sessSum + (sess.enrolledCount || 0), 0), 0), 0);
  }

  getTodaySessions(): number {
    const cal = this.calendar();
    if (!cal?.coaches) return 0;
    const today = new Date().toISOString().split('T')[0];
    return cal.coaches.reduce((sum, coach) => 
      sum + coach.days.filter(day => day.date === today)
        .reduce((daySum, day) => daySum + day.sessions.length, 0), 0);
  }

  ngOnInit(): void {
    this.loadWeeklyCalendar();
    this.coachPayments.loadPendingPayments();
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  private formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadWeeklyCalendar(): void {
    this.isLoading.set(true);
    const weekStart = this.formatDateForAPI(this.currentWeekStart());

    this.api
      .getWeeklyCalendar(weekStart)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (calendar) => {
          this.calendar.set(calendar);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut încărca calendarul', undefined, { duration: 3000 });
        }
      });
  }

  isConfirming(id: string): boolean {
    return this.coachPayments.isConfirming(id);
  }

  trackPaymentById(index: number, payment: CoachPaymentReportRow): string {
    return payment.id;
  }

  confirmCashPayment(paymentId: string): void {
    if (this.coachPayments.isConfirming(paymentId)) return;
    this.coachPayments.confirmPayment(paymentId, () => {
      this.loadWeeklyCalendar();
    });
  }

  getConfirmAriaLabel(payment: CoachPaymentReportRow): string {
    const childName = payment.childName || 'copil';
    const isConfirming = this.coachPayments.isConfirming(payment.id);
    return isConfirming
      ? `Se confirmă plata cash pentru ${childName}`
      : `Confirmă plata cash pentru ${childName}`;
  }

  previousWeek(): void {
    const current = this.currentWeekStart();
    const previous = new Date(current);
    previous.setDate(previous.getDate() - 7);
    this.currentWeekStart.set(previous);
    this.loadWeeklyCalendar();
  }

  nextWeek(): void {
    const current = this.currentWeekStart();
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    this.currentWeekStart.set(next);
    this.loadWeeklyCalendar();
  }

  get weekLabel(): string {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    const formatter = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  isToday(dateString: string): boolean {
    const today = new Date();
    const date = new Date(dateString);
    
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  openAttendanceModal(occurrenceId: string): void {
    // Load session details
    this.api
      .getSessionAttendance(occurrenceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          const dialogRef = this.dialog.open(AttendanceModalComponent, {
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '95vh',
            panelClass: 'attendance-modal-panel',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            restoreFocus: false,
            data: { session } as AttendanceModalData
          });

          dialogRef.afterClosed().subscribe((result) => {
            if (!result) return;

            if (result.action === 'save') {
              this.saveAttendance(occurrenceId, result.children);
            } else if (result.action === 'addSessions') {
              this.addSessionsForChild(result.child.enrollmentId, result.count ?? 5);
            } else if (result.action === 'addSessionsAll') {
              const items = (result.children ?? []).map((c: any) => ({ enrollmentId: c.enrollmentId, count: result.count ?? 5 }));
              this.bulkAddSessions(items);
            }
          });
        },
        error: () => {
          this.snackbar.open('Nu am putut încărca detaliile sesiunii', undefined, { duration: 3000 });
        }
      });
  }

  private saveAttendance(occurrenceId: string, children: any[]): void {
    const items = children.map((child) => ({
      childId: child.childId,
      status: child.present ? 'PRESENT' : 'ABSENT'
    }));

    this.api
      .markSessionAttendance(occurrenceId, items)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Prezențe salvate cu succes', undefined, { duration: 3000 });
          this.loadWeeklyCalendar(); // Reload calendar
        },
        error: () => {
          this.snackbar.open('Eroare la salvarea prezențelor', undefined, { duration: 3000 });
        }
      });
  }

  private addSessionsForChild(enrollmentId: string, count: number): void {
    this.api.purchaseSessions(enrollmentId, { numberOfSessions: count, paymentMethod: 'CASH' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open(`Plată cash înregistrată pentru ${count} sesiuni. Confirmă primirea banilor în lista de plăți.`, undefined, { duration: 4000 });
          this.loadWeeklyCalendar();
          this.coachPayments.loadPendingPayments();
        },
        error: () => this.snackbar.open('Eroare la adăugarea sesiunilor', undefined, { duration: 3000 })
      });
  }

  private bulkAddSessions(items: Array<{ enrollmentId: string; count: number }>): void {
    const reqs = items.map(i => this.api.purchaseSessions(i.enrollmentId, { numberOfSessions: i.count, paymentMethod: 'CASH' }));
    if (reqs.length === 0) return;
    forkJoin(reqs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open(`Sesiuni adăugate pentru ${reqs.length} copii`, undefined, { duration: 3000 });
          this.loadWeeklyCalendar();
          this.coachPayments.loadPendingPayments();
        },
        error: () => {
          this.snackbar.open('Eroare la adăugarea multiplă a sesiunilor', undefined, { duration: 3000 });
          this.loadWeeklyCalendar();
          this.coachPayments.loadPendingPayments();
        }
      });
  }

}

