import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface EnrollmentReadyEvent {
  enrollmentId: string;
  status: string;
  timestamp: number;
}

export interface PaymentFailedEvent {
  enrollmentId: string;
  reason: string;
  timestamp: number;
}

export interface SessionPurchaseEvent {
  enrollmentId: string;
  courseId: string;
  sessionCount: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private authService = inject(AuthService);
  private supabase = inject(SupabaseService);
  private platformId = inject(PLATFORM_ID);
  private channel: RealtimeChannel | null = null;
  private adminChannel: RealtimeChannel | null = null;
  private connected = signal(false);

  private enrollmentReadySubject = new Subject<EnrollmentReadyEvent>();
  private paymentFailedSubject = new Subject<PaymentFailedEvent>();
  private sessionPurchaseSubject = new Subject<SessionPurchaseEvent>();

  public enrollmentReady$ = this.enrollmentReadySubject.asObservable();
  public paymentFailed$ = this.paymentFailedSubject.asObservable();
  public sessionPurchase$ = this.sessionPurchaseSubject.asObservable();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.authService.isLoggedIn()) {
      this.connect();
    }

    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  connect(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.connected()) return;

    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    // User-specific payment channel
    this.channel = this.supabase.channel(`user:${user.id}:payments`);
    this.channel
      .on('broadcast', { event: 'enrollment_ready' }, ({ payload }) => {
        this.enrollmentReadySubject.next(payload as EnrollmentReadyEvent);
      })
      .on('broadcast', { event: 'payment_failed' }, ({ payload }) => {
        this.paymentFailedSubject.next(payload as PaymentFailedEvent);
      })
      .subscribe();

    // Admin/coach broadcast channel
    if (user.role === 'ADMIN' || user.role === 'COACH') {
      this.adminChannel = this.supabase.channel('admin:session-purchases');
      this.adminChannel
        .on('broadcast', { event: 'session_purchase' }, ({ payload }) => {
          this.sessionPurchaseSubject.next(payload as SessionPurchaseEvent);
        })
        .subscribe();
    }

    this.connected.set(true);
  }

  disconnect(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.adminChannel) {
      this.supabase.removeChannel(this.adminChannel);
      this.adminChannel = null;
    }
    this.connected.set(false);
  }

  isConnected(): boolean {
    return this.connected();
  }
}
