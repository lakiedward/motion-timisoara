import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { EnrollmentService, ParentEnrollmentListItem } from '../../services/enrollment.service';

@Component({
  selector: 'app-enrollments',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, RouterLink, MatIconModule, MatButtonModule, MatDividerModule, DatePipe],
  templateUrl: './enrollments.component.html',
  styleUrls: ['./enrollments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnrollmentsComponent implements OnInit {
  private readonly enrollmentService = inject(EnrollmentService);

  readonly enrollments = signal<ParentEnrollmentListItem[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.enrollmentService
      .getEnrollments()
      .subscribe({
        next: (items) => {
          this.enrollments.set(items ?? []);
          this.isLoading.set(false);
          this.hasError.set(false);
        },
        error: () => {
          this.enrollments.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });
  }

  paymentLabel(enrollment: ParentEnrollmentListItem): string {
    if (enrollment.paymentAmount == null) {
      return '-';
    }

    const currency = enrollment.paymentCurrency ?? 'RON';
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(enrollment.paymentAmount / 100);
  }

  paymentClass(status?: ParentEnrollmentListItem['paymentStatus']): string {
    switch (status) {
      case 'completed':
        return 'status-badge status-badge--success';
      case 'pending':
      case 'partial':
      case 'refunded':
        return 'status-badge status-badge--warning';
      case 'failed':
        return 'status-badge status-badge--danger';
      default:
        return 'status-badge';
    }
  }

  enrollmentStatusClass(status: ParentEnrollmentListItem['status']): string {
    switch (status) {
      case 'active':
      case 'completed':
        return 'status-badge status-badge--success';
      case 'pending':
        return 'status-badge status-badge--warning';
      case 'cancelled':
        return 'status-badge status-badge--danger';
      default:
        return 'status-badge';
    }
  }

  trackByEnrollment(_: number, enrollment: ParentEnrollmentListItem): string {
    return enrollment.id;
  }

  isLowSessions(enrollment: ParentEnrollmentListItem): boolean {
    const remaining = enrollment.remainingSessions ?? 0;
    const purchased = enrollment.purchasedSessions ?? 0;
    return purchased > 0 && remaining <= 3;
  }
}

