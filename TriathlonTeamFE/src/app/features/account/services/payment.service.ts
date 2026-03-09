import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

interface PaymentIntentResponse {
  clientSecret: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);

  createIntent(enrollmentId: string): Observable<PaymentIntentResponse> {
    return this.http.post<PaymentIntentResponse>('/api/payments/create-intent', { enrollmentId });
  }
}
