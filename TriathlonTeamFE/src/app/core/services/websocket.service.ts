import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Client, StompConfig, IFrame, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../tokens/api-base-url.token';

/**
 * WebSocket real-time notification service
 *
 * Provides real-time push notifications from backend using STOMP protocol over WebSocket.
 * Primary use case: Notify frontend when Stripe webhook completes payment processing,
 * eliminating race conditions with setTimeout delays.
 *
 * Connection lifecycle:
 * 1. Auto-connects when user is authenticated
 * 2. Subscribes to user-specific topics: /topic/user/{userId}/payments
 * 3. Auto-reconnects on disconnect (5s delay)
 * 4. Disconnects on logout
 *
 * Events emitted:
 * - enrollmentReady$: Enrollment activated after payment success
 * - paymentFailed$: Payment failed notification
 */

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

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);
  private apiBaseUrl = inject(API_BASE_URL);
  private client: Client | null = null;
  private connected = signal(false);

  // Subjects for different event types
  private enrollmentReadySubject = new Subject<EnrollmentReadyEvent>();
  private paymentFailedSubject = new Subject<PaymentFailedEvent>();
  private sessionPurchaseSubject = new Subject<SessionPurchaseEvent>();

  public enrollmentReady$ = this.enrollmentReadySubject.asObservable();
  public paymentFailed$ = this.paymentFailedSubject.asObservable();
  public sessionPurchase$ = this.sessionPurchaseSubject.asObservable();

  constructor() {
    // Only run WS logic in the browser
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Auto-connect on service initialization if user is logged in
    if (this.authService.isLoggedIn()) {
      this.connect();
    }

    // Listen to auth state changes to connect/disconnect automatically
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  /**
   * Connect to WebSocket server
   *
   * Establishes STOMP connection over WebSocket with SockJS fallback.
   * Auto-reconnects on disconnect. Idempotent - safe to call multiple times.
   */
  connect(): void {
    // Guard: browser-only
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.connected()) {
      console.log('✅ WebSocket already connected');
      return;
    }

    const wsUrl = this.getWebSocketUrl();

    const sockJsOptions: any = {
      transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
      transportOptions: {
        'xhr-streaming': { withCredentials: true },
        'xhr-polling': { withCredentials: true },
      },
    };

    const config: StompConfig = {
      webSocketFactory: () => new SockJS(wsUrl, undefined, sockJsOptions) as any,
      reconnectDelay: 5000, // Auto-reconnect after 5s
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg: string) => {
        // Only log important messages (errors and connections)
        if (msg.includes('ERROR') || msg.includes('CONNECT')) {
          console.log('🔌 WebSocket:', msg);
        }
      },
    };

    this.client = new Client(config);

    this.client.onConnect = () => {
      console.log('✅ WebSocket connected');
      this.connected.set(true);
      this.subscribeToUserTopics();
      this.subscribeToAdminTopics();
    };

    this.client.onDisconnect = () => {
      console.log('❌ WebSocket disconnected');
      this.connected.set(false);
    };

    this.client.onStompError = (frame: IFrame) => {
      console.error('❌ WebSocket STOMP error:', frame.headers['message']);
    };

    this.client.activate();
  }

  /**
   * Subscribe to user-specific payment notifications
   *
   * Subscribes to /topic/user/{userId}/payments for real-time payment updates.
   * Called automatically after successful connection.
   */
  private subscribeToUserTopics(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      console.warn('⚠️ No user ID, cannot subscribe to WebSocket topics');
      return;
    }

    const topic = `/topic/user/${user.id}/payments`;

    this.client?.subscribe(topic, (message: IMessage) => {
      try {
        const event = JSON.parse(message.body);

        // Enrollment ready event (payment succeeded, enrollment activated)
        if (event.status === 'ACTIVE') {
          console.log('✅ Enrollment ready event:', event);
          this.enrollmentReadySubject.next(event as EnrollmentReadyEvent);
        }
        // Payment failed event
        else if (event.reason) {
          console.log('❌ Payment failed event:', event);
          this.paymentFailedSubject.next(event as PaymentFailedEvent);
        }
        // Unknown event type
        else {
          console.warn('⚠️ Unknown WebSocket event:', event);
        }
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    });

    console.log(`✅ Subscribed to: ${topic}`);
  }

  /**
   * Disconnect from WebSocket
   *
   * Closes WebSocket connection and cleans up resources.
   * Called automatically on logout.
   */
  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connected.set(false);
      console.log('✅ WebSocket disconnected');
    }
  }

  /**
   * Check if WebSocket is connected
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected();
  }

  /**
   * Get WebSocket URL from meta tag or environment
   *
   * Reads api-base-url meta tag and constructs WebSocket endpoint URL.
   * Falls back to localhost if meta tag is missing.
   *
   * @returns WebSocket URL (e.g., https://backend.com/ws)
   */
  private getWebSocketUrl(): string {
    const raw = (this.apiBaseUrl || '').trim().replace(/\/$/, '');
    let candidate = raw;
    if (candidate && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
      const isLocal = /^(localhost|127\.0\.0\.1)(:?\d+)?(\/|$)/i.test(candidate);
      candidate = `${isLocal ? 'http' : 'https'}://${candidate}`;
    }
    if (/^wss?:\/\//i.test(candidate)) {
      candidate = candidate.replace(/^ws/i, 'http');
    }
    let effectiveBase = candidate;
    try {
      new URL(effectiveBase);
    } catch {
      effectiveBase = 'http://localhost:8081';
    }
    return `${effectiveBase}/ws`;
  }

  /**
   * Subscribe to admin/coach broadcast notifications
   *
   * Subscribes to /topic/admin/session-purchases for real-time session purchase updates.
   * Only admins and coaches need this subscription for attendance panel auto-refresh.
   */
  private subscribeToAdminTopics(): void {
    const user = this.authService.getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'COACH')) {
      return; // Only admin/coach need admin topics
    }

    const topic = '/topic/admin/session-purchases';

    this.client?.subscribe(topic, (message: IMessage) => {
      try {
        const event = JSON.parse(message.body) as SessionPurchaseEvent;
        console.log('✅ Session purchase event:', event);
        this.sessionPurchaseSubject.next(event);
      } catch (error) {
        console.error('❌ Failed to parse session purchase message:', error);
      }
    });

    console.log(`✅ Subscribed to: ${topic}`);
  }
}
