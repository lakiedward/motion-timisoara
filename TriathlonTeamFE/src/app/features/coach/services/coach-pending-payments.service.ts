import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PendingPaymentsService } from '../../club/services/pending-payments.service';
import { CoachApiService, CoachPaymentReportRow } from './coach-api.service';

@Injectable()
export class CoachPendingPaymentsService extends PendingPaymentsService<CoachPaymentReportRow> {
  private readonly api = inject(CoachApiService);

  protected override loadPendingPaymentsApi(): Observable<CoachPaymentReportRow[]> {
    return this.api.getPendingCashPayments();
  }

  protected override confirmPaymentApi(id: string): Observable<void> {
    return this.api.markCashPaid(id);
  }
}
