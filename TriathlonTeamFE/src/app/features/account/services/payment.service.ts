import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';

interface PaymentIntentResponse {
  clientSecret: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly supabase = inject(SupabaseService);

  createIntent(enrollmentId: string): Observable<PaymentIntentResponse> {
    // Complex mutation (Stripe interaction) -> Edge Function
    return from(
      this.supabase.invokeFunction<PaymentIntentResponse>('create-payment-intent', {
        enrollmentId
      })
    );
  }
}
