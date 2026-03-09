import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachService, CoachActivity, ActivityParticipant } from '../../services/coach.service';

@Component({
  selector: 'app-coach-activities',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './coach-activities.component.html',
  styleUrls: ['./coach-activities.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachActivitiesComponent implements OnInit {
  private readonly coachService = inject(CoachService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly activities = signal<CoachActivity[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly updatingId = signal<string | null>(null);

  // Stats helpers
  getActiveCount(): number {
    return this.activities().filter(a => a.active).length;
  }

  getTotalEnrolled(): number {
    return this.activities().reduce((sum, a) => sum + (a.enrolledCount || 0), 0);
  }

  trackByActivity(_: number, activity: CoachActivity): string {
    return activity.id;
  }
  
  // Participants dialog state
  readonly showParticipantsDialog = signal(false);
  readonly selectedActivity = signal<CoachActivity | null>(null);
  readonly participants = signal<ActivityParticipant[]>([]);
  readonly loadingParticipants = signal(false);
  readonly confirmingPaymentId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadActivities();
  }

  loadActivities(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.coachService.getMyActivities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activities) => {
          this.activities.set(activities ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.activities.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
          this.snackbar.open('Nu am putut încărca lista de activități', undefined, { duration: 4000 });
        }
      });
  }

  goToCreate(): void {
    void this.router.navigate(['/coach/activities', 'new']);
  }

  editActivity(activity: CoachActivity): void {
    void this.router.navigate(['/coach/activities', activity.id, 'edit']);
  }

  toggleStatus(activity: CoachActivity): void {
    if (this.updatingId()) return;
    const nextActive = !activity.active;
    this.updatingId.set(activity.id);
    this.coachService.setActivityStatus(activity.id, nextActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activities.update((list) => 
            list.map((a) => (a.id === activity.id ? { ...a, active: nextActive } : a))
          );
          this.updatingId.set(null);
          this.snackbar.open(
            nextActive ? 'Activitatea a fost activată' : 'Activitatea a fost dezactivată',
            undefined,
            { duration: 3000 }
          );
        },
        error: () => {
          this.updatingId.set(null);
          this.snackbar.open('Nu am putut actualiza statusul', undefined, { duration: 4000 });
        }
      });
  }

  deleteActivity(activity: CoachActivity): void {
    if (this.updatingId()) return;
    const confirmed = confirm(`Sigur vrei să ștergi activitatea "${activity.name}"?`);
    if (!confirmed) return;
    
    this.updatingId.set(activity.id);
    this.coachService.deleteActivity(activity.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activities.update((list) => list.filter((a) => a.id !== activity.id));
          this.updatingId.set(null);
          this.snackbar.open('Activitatea a fost ștearsă', undefined, { duration: 3000 });
        },
        error: (err) => {
          this.updatingId.set(null);
          const message = err?.error?.message || 'Nu am putut șterge activitatea';
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatTime(timeStr: string): string {
    return timeStr?.substring(0, 5) || '';
  }

  // Participants dialog methods
  viewParticipants(activity: CoachActivity): void {
    this.selectedActivity.set(activity);
    this.showParticipantsDialog.set(true);
    this.loadParticipants(activity.id);
  }

  closeParticipantsDialog(): void {
    this.showParticipantsDialog.set(false);
    this.selectedActivity.set(null);
    this.participants.set([]);
  }

  private loadParticipants(activityId: string): void {
    this.loadingParticipants.set(true);
    this.coachService.getActivityParticipants(activityId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (participants) => {
          this.participants.set(participants ?? []);
          this.loadingParticipants.set(false);
        },
        error: () => {
          this.participants.set([]);
          this.loadingParticipants.set(false);
          this.snackbar.open('Nu am putut încărca participanții', undefined, { duration: 4000 });
        }
      });
  }

  confirmCashPayment(participant: ActivityParticipant): void {
    if (!participant.payment?.id || this.confirmingPaymentId()) return;
    
    const activityId = this.selectedActivity()?.id;
    if (!activityId) return;

    this.confirmingPaymentId.set(participant.payment.id);
    this.coachService.confirmActivityCashPayment(activityId, participant.payment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Update participant status locally
          this.participants.update((list) =>
            list.map((p) =>
              p.id === participant.id
                ? { 
                    ...p, 
                    status: 'ACTIVE' as const,
                    payment: p.payment ? { ...p.payment, status: 'SUCCEEDED' as const } : p.payment 
                  }
                : p
            )
          );
          // Also update the enrollment count in the activities list
          this.activities.update((list) =>
            list.map((a) =>
              a.id === activityId
                ? { ...a, enrolledCount: a.enrolledCount + 1 }
                : a
            )
          );
          this.confirmingPaymentId.set(null);
          this.snackbar.open('Plata cash a fost confirmată', undefined, { duration: 3000 });
        },
        error: () => {
          this.confirmingPaymentId.set(null);
          this.snackbar.open('Nu am putut confirma plata', undefined, { duration: 4000 });
        }
      });
  }
}
