import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface SessionPurchaseRequest {
  sessionCount: number;
  paymentMethod: 'CARD' | 'CASH';
}

export interface SessionPurchaseResponse {
  enrollmentId: string;
  sessionsPurchased: number;
  totalPrice: number;
  newRemainingBalance: number;
  requiresPaymentIntent: boolean;
}

@Injectable({ providedIn: 'root' })
export class SessionPurchaseService {
  private readonly http = inject(HttpClient);

  purchaseAdditionalSessions(
    enrollmentId: string,
    request: SessionPurchaseRequest
  ): Observable<SessionPurchaseResponse> {
    return this.http.post<SessionPurchaseResponse>(
      `/api/enrollments/${enrollmentId}/purchase-sessions`,
      request
    );
  }
}

