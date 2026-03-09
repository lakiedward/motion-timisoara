import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PendingPaymentsService } from './pending-payments.service';
import { ClubAttendanceApiService, ClubPaymentReportRow } from './club-attendance-api.service';

@Injectable()
export class ClubPendingPaymentsService extends PendingPaymentsService<ClubPaymentReportRow> {
  private readonly api = inject(ClubAttendanceApiService);

  protected loadPendingPaymentsApi(): Observable<ClubPaymentReportRow[]> {
    return this.api.getPendingCashPayments();
  }

  protected confirmPaymentApi(id: string): Observable<void> {
    return this.api.markCashPaid(id);
  }
}
