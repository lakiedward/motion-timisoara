import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';

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
  private readonly supabase = inject(SupabaseService);

  purchaseAdditionalSessions(
    enrollmentId: string,
    request: SessionPurchaseRequest
  ): Observable<SessionPurchaseResponse> {
    // Complex mutation (payment + enrollment update) -> Edge Function
    return from(
      this.supabase.invokeFunction<SessionPurchaseResponse>('purchase-sessions', {
        enrollmentId,
        ...request
      })
    );
  }
}
