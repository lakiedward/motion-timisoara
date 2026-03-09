import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { EMPTY, TimeoutError, from, of, Subscription } from 'rxjs';
import { catchError, distinctUntilChanged, finalize, map, startWith, switchMap, take, timeout, tap } from 'rxjs/operators';
import { loadStripe, Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ChildrenService, ChildValidationResult } from '../../services/children.service';
import { EnrollmentService, EnrollmentRequest } from '../../services/enrollment.service';
import { PaymentService } from '../../services/payment.service';
import { PublicApiService } from '../../../../core/services/public-api.service';
import { WebSocketService } from '../../../../core/services/websocket.service';

interface CheckoutProduct {
  id: string;
  name: string;
  price: number;
  pricePerSession?: number;
  currency: string;
  allowCash: boolean;
}

// Note: Do not resolve Stripe key at module load; resolve at runtime to avoid stale values

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatRadioModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly childrenService = inject(ChildrenService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly paymentService = inject(PaymentService);
  private readonly publicApi = inject(PublicApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly wsService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private wsSubscription?: Subscription;
  private cardMountTimer: ReturnType<typeof setTimeout> | null = null;
  private cardMountAttempts = 0;

  @ViewChild('cardElement') cardElementRef?: ElementRef<HTMLDivElement>;
  @ViewChild('stepper') stepper?: MatStepper;

  // NEW: Changed from single selection to multiple
  readonly childForm = this.fb.nonNullable.group({
    selectedChildIds: [[] as string[], Validators.required],
  });

  readonly confirmForm = this.fb.nonNullable.group({
    rulesAccepted: [false, Validators.requiredTrue],
  });

  readonly paymentForm = this.fb.nonNullable.group({
    method: ['CARD', Validators.required],
    sessionPackageSize: [10, [Validators.required, Validators.min(1)]],
  });

  // Billing details (PF) - all required
  readonly billingForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    addressLine1: ['', [Validators.required, Validators.minLength(3)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    postalCode: ['', [Validators.required, Validators.minLength(3)]],
  });

  // NEW: Form for adding child inline
  readonly newChildForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    birthDate: ['', Validators.required],
    emergencyPhone: ['', [Validators.required, Validators.pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)]],
    allergies: [''],
    emergencyContactName: [''],
  });

  readonly children = this.childrenService.children$;
  private readonly childrenList = toSignal(this.childrenService.children$, { initialValue: [] });
  private readonly childNameById = computed(() => {
    const map = new Map<string, string>();
    for (const child of this.childrenList()) {
      map.set(child.id, child.name);
    }
    return map;
  });

  // NEW: Tracking state
  selectedChildIds = signal<string[]>([]);
  validationResults = signal<Map<string, ChildValidationResult>>(new Map());
  isValidating = signal(false);
  showAddChildForm = signal(false);
  isSavingChild = signal(false);

  product: CheckoutProduct | null = null;
  kind: 'COURSE' | 'CAMP' | 'ACTIVITY' = 'COURSE';
  productIdOrSlug = '';
  isLoadingProduct = signal(true);
  loadError = signal(false);

  isProcessingPayment = false;
  paymentError: string | null = null;

  private stripe?: Stripe | null;
  private elements?: StripeElements;
  private cardElement?: StripeCardElement;
  private currentStripeKey?: string;
  private currentDraftEnrollmentId: string | null = null;
  readonly stepperOrientation$ = this.breakpointObserver
    .observe('(max-width: 720px)')
    .pipe(map((result: BreakpointState) => (result.matches ? 'vertical' : 'horizontal')));

  readonly hasInvalidSelectedChildren = computed(() => {
    const selected = this.selectedChildIds();
    if (selected.length === 0) return false;
    const validations = this.validationResults();
    for (const id of selected) {
      const v = validations.get(id);
      if (v && v.ageValid === false) {
        return true;
      }
    }
    return false;
  });

  ngOnInit(): void {
    void this.loadStripe();
    this.childrenService
      .loadChildren()
      .pipe(catchError(() => of([])))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // Keep Stripe Elements lifecycle in sync with the real form control value,
    // rather than template (change) events (prevents races when *ngIf recreates host)
    this.paymentForm.controls.method.valueChanges
      .pipe(startWith(this.paymentForm.controls.method.value), distinctUntilChanged())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((method) => {
        if (method === 'CARD') {
          this.paymentError = null;
          this.scheduleEnsureCardMounted();
        } else {
          this.paymentError = null;
          this.teardownCardElement();
        }
        this.cdr.markForCheck();
      });

    this.route.queryParamMap
      .pipe(
        switchMap((params) => {
          const kind = params.get('kind');
          if (kind !== 'COURSE' && kind !== 'CAMP' && kind !== 'ACTIVITY') {
            this.loadError.set(true);
            this.isLoadingProduct.set(false);
            return of(null);
          }
          this.kind = kind;
          // COURSE and ACTIVITY use 'id', CAMP uses 'slug'
          const idParam = params.get(kind === 'CAMP' ? 'slug' : 'id');
          if (!idParam) {
            this.loadError.set(true);
            this.isLoadingProduct.set(false);
            return of(null);
          }
          this.productIdOrSlug = idParam;
          if (kind === 'COURSE') {
            this.ensureDefaultCourseSessions();
          }
          return this.fetchProduct(kind, idParam);
        })
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          if (product) {
            this.product = product;
            if (product.allowCash) {
              this.paymentForm.patchValue({ method: 'CARD' });
            }
          }
          this.isLoadingProduct.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadError.set(true);
          this.isLoadingProduct.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.cancelCardMountTimer();
    this.teardownCardElement();
    this.elements = undefined;
    this.stripe = undefined;
    this.wsSubscription?.unsubscribe();
  }

  get paymentOptions(): Array<{ value: 'CARD' | 'CASH'; label: string }> {
    if (!this.product) {
      return [{ value: 'CARD', label: 'Card' }];
    }
    if (this.product.allowCash) {
      return [
        { value: 'CARD', label: 'Card' },
        { value: 'CASH', label: 'Cash la fata locului' },
      ];
    }
    return [{ value: 'CARD', label: 'Card' }];
  }

  get totalPrice(): number {
    if (!this.product) {
      return 0;
    }

    const childCount = this.selectedChildIds().length;
    if (childCount === 0) {
      return 0;
    }

    // For courses, calculate based on sessions
    if (this.kind === 'COURSE' && this.product.pricePerSession) {
      const sessionCount = this.paymentForm.value.sessionPackageSize ?? 10;
      return this.product.pricePerSession * sessionCount * childCount;
    }

    // For camps and activities, use the base price
    return this.product.price * childCount;
  }

  goBack(): void {
    // Prefer navigating back to the entity details page (when checkout is initiated from there)
    if (this.kind === 'COURSE') {
      void this.router.navigate(['/cursuri', this.productIdOrSlug]);
      return;
    }
    if (this.kind === 'ACTIVITY') {
      void this.router.navigate(['/activitati', this.productIdOrSlug]);
      return;
    }
    if (this.kind === 'CAMP') {
      void this.router.navigate(['/tabere', this.productIdOrSlug]);
      return;
    }
    void this.router.navigate(['/account']);
  }

  childName(childId: string): string {
    return this.childNameById().get(childId) ?? '—';
  }

  // NEW: Handle child selection toggle
  onChildSelectionChange(childId: string, selected: boolean): void {
    const currentIds = this.selectedChildIds();
    if (selected) {
      this.selectedChildIds.set([...currentIds, childId]);
    } else {
      this.selectedChildIds.set(currentIds.filter(id => id !== childId));
    }

    this.childForm.patchValue({ selectedChildIds: this.selectedChildIds() });

    // Validate selection
    if (this.selectedChildIds().length > 0 && this.product) {
      this.validateSelection();
    }
  }

  // NEW: Check if child is selected
  isChildSelected(childId: string): boolean {
    return this.selectedChildIds().includes(childId);
  }

  // NEW: Get validation result for a child
  getValidation(childId: string): ChildValidationResult | undefined {
    return this.validationResults().get(childId);
  }

  // NEW: Check if child is valid for enrollment
  isChildValid(childId: string): boolean {
    const validation = this.validationResults().get(childId);
    return validation?.ageValid ?? true;
  }

  // NEW: Validate selected children
  private validateSelection(): void {
    if (!this.product || this.selectedChildIds().length === 0) {
      return;
    }

    this.isValidating.set(true);
    this.childrenService
      .validateChildren(this.product.id, this.selectedChildIds())
      .pipe(
        finalize(() => {
          this.isValidating.set(false);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (results) => {
          const map = new Map<string, ChildValidationResult>();
          results.forEach(result => map.set(result.childId, result));
          this.validationResults.set(map);
        },
        error: (err) => {
          console.error('Validation error:', err);
          this.snackbar.open('Nu am putut valida copiii selectați', undefined, { duration: 3000 });
        }
      });
  }

  // NEW: Toggle add child form
  toggleAddChildForm(): void {
    this.showAddChildForm.update(v => !v);
    if (!this.showAddChildForm()) {
      this.newChildForm.reset();
    }
  }

  cancelAddChild(): void {
    this.showAddChildForm.set(false);
    this.newChildForm.reset();
  }

  // NEW: Save new child
  saveNewChild(): void {
    if (this.newChildForm.invalid) {
      this.newChildForm.markAllAsTouched();
      return;
    }

    this.isSavingChild.set(true);
    this.childrenService
      .createChild(this.newChildForm.value as any)
      .pipe(
        finalize(() => {
          this.isSavingChild.set(false);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (child) => {
          this.snackbar.open('Copil adăugat cu succes', undefined, { duration: 3000 });
          this.showAddChildForm.set(false);
          this.newChildForm.reset();
          // Auto-select the new child
          this.onChildSelectionChange(child.id, true);
        },
        error: () => {
          this.snackbar.open('Nu am putut adăuga copilul', undefined, { duration: 3000 });
        }
      });
  }

  // NEW: Calculate age from birth date
  calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // NEW: Calculate total price
  calculateTotal(): number {
    return this.totalPrice;
  }

  private ensureDefaultCourseSessions(): void {
    const current = this.paymentForm.value.sessionPackageSize ?? 10;
    // If still on the legacy default (1) or unset, bump to 10 (consistent with UI + price breakdown)
    if (!current || current === 1) {
      this.paymentForm.patchValue({ sessionPackageSize: 10 });
    }
  }

  onPaymentMethodChange(): void {
    // Kept for backwards compatibility (template no longer relies on this).
    // Lifecycle is driven by paymentForm.controls.method.valueChanges.
    const method = this.paymentForm.controls.method.value;
    if (method === 'CARD') {
      this.paymentError = null;
      this.scheduleEnsureCardMounted();
      return;
    }
    this.paymentError = null;
    this.teardownCardElement();
  }

  setSessionCount(count: number): void {
    this.paymentForm.patchValue({ sessionPackageSize: count });
  }

  onStepSelectionChange(index: number): void {
    // With the new Billing step, the Payment step index becomes 3
    if (index === 3 && this.paymentForm.controls.method.value === 'CARD') {
      this.scheduleEnsureCardMounted();
    }
  }

  submit(): void {
    if (!this.product) {
      return;
    }
    if (this.paymentForm.value.method === 'CASH') {
      this.handleCashFlow();
    } else {
      void this.handleCardFlow();
    }
  }

  private handleCashFlow(): void {
    this.isProcessingPayment = true;
    this.enrollmentService
      .createEnrollment(this.buildEnrollmentPayload('CASH'))
      .pipe(finalize(() => (this.isProcessingPayment = false)))
      .subscribe({
        next: () => {
          this.snackbar.open('Rezervare creată! Sesiunile vor fi activate după confirmarea plății cash de către antrenor.', undefined, {
            duration: 5000,
          });
          // Navigate to account (data will be automatically loaded)
          void this.router.navigate(['/account']);
        },
        error: () => {
          this.snackbar.open('Nu am putut crea rezervarea. Încearcă din nou.', undefined, {
            duration: 5000,
          });
        },
      });
  }

  private async handleCardFlow(): Promise<void> {
    if (!this.cardElement) {
      await this.ensureCardMounted();
    }
    if (!this.cardElement || !this.stripe) {
      this.snackbar.open('Stripe nu a putut fi initializat.', undefined, { duration: 5000 });
      return;
    }

    this.isProcessingPayment = true;
    this.paymentError = null;

    this.enrollmentService
      .createEnrollment(this.buildEnrollmentPayload('CARD'))
      .pipe(
        tap((enrollment) => {
          this.currentDraftEnrollmentId = enrollment.enrollmentId;
        }),
        switchMap((enrollment) =>
          this.paymentService.createIntent(enrollment.enrollmentId).pipe(
            switchMap(({ clientSecret }) =>
              from(
                this.stripe!.confirmCardPayment(clientSecret, {
                  payment_method: {
                    card: this.cardElement!,
                    billing_details: {
                      name: this.billingForm.value.name!,
                      email: this.billingForm.value.email!,
                      address: {
                        line1: this.billingForm.value.addressLine1!,
                        city: this.billingForm.value.city!,
                        postal_code: this.billingForm.value.postalCode!,
                      },
                    } as any,
                  },
                }),
              ).pipe(timeout(20000)),
            ),
          ),
        ),
        finalize(() => (this.isProcessingPayment = false)),
      )
      .subscribe({
        next: (result: any) => {
          if (result.error) {
            this.handleStripeFailure(result.error.message ?? 'Plata a eșuat.');
            return;
          }
          if (result.paymentIntent?.status === 'succeeded') {
            this.currentDraftEnrollmentId = null;
            this.resetCardElement();
            this.snackbar.open('Plata reușită! Se procesează înscrierea...', undefined, { duration: 10000 });

            // ✅ NEW: Wait for WebSocket notification (with 15s timeout fallback)
            this.waitForEnrollmentReady(15000);
          } else {
            this.handleStripeFailure('Nu am putut confirma plata.');
          }
        },
        error: (error: unknown) => {
          this.handleCardError(error);
        },
      });
  }

  private handleStripeFailure(message: string): void {
    this.paymentError = message;
    this.snackbar.open(message, undefined, { duration: 5000 });
    this.cancelCurrentDraft();
    this.cdr.markForCheck();
  }

  private handleCardError(error: unknown): void {
    const message = this.resolvePaymentErrorMessage(error);
    this.paymentError = message;
    this.snackbar.open(message, undefined, { duration: 5000 });
    this.cancelCurrentDraft();
    console.error('Card payment error', error);
    this.cdr.markForCheck();
  }

  private resolvePaymentErrorMessage(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'Confirmarea plății a depășit timpul limită. Încearcă din nou.';
    }
    if (error && typeof error === 'object') {
      const maybeStripe = error as { message?: string };
      if (typeof maybeStripe.message === 'string' && maybeStripe.message.trim().length > 0) {
        return maybeStripe.message;
      }
      const nestedMessage = (error as any)?.error?.message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
        return nestedMessage;
      }
      const status = (error as any)?.status;
      if (typeof status === 'number' && status >= 400) {
        return 'Nu am putut iniția plata. Încearcă din nou.';
      }
    }
    return 'Nu am putut procesa plata.';
  }

  private cancelCurrentDraft(): void {
    const draftId = this.currentDraftEnrollmentId;
    this.currentDraftEnrollmentId = null;
    this.resetCardElement();
    if (!draftId) {
      return;
    }
    this.enrollmentService
      .cancelDraftEnrollment(draftId)
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  private resetCardElement(): void {
    this.cardElement?.clear();
  }

  /**
   * Wait for real-time WebSocket notification that enrollment is ready
   * Falls back to navigation after timeout if WebSocket fails
   */
  private waitForEnrollmentReady(timeoutMs: number): void {
    // Clean up any previous subscription
    this.wsSubscription?.unsubscribe();

    // Subscribe to both success and failure notifications
    const success$ = this.wsService.enrollmentReady$.pipe(
      take(1),
      timeout(timeoutMs)
    );

    const failure$ = this.wsService.paymentFailed$.pipe(
      take(1),
      timeout(timeoutMs)
    );

    // Handle enrollment ready notification
    const successSub = success$.subscribe({
      next: (event) => {
        console.log('✅ Enrollment ready via WebSocket:', event);
        this.snackbar.open('Înscriere activată! Redirecționare...', undefined, { duration: 2000 });
        setTimeout(() => {
          void this.router.navigate(['/account']);
        }, 500);
      },
      error: (err) => {
        // Timeout reached - fallback to navigation anyway
        console.warn('⏱️ WebSocket timeout, navigating anyway:', err);
        void this.router.navigate(['/account']);
      }
    });

    // Handle payment failure notification
    const failureSub = failure$.subscribe({
      next: (event) => {
        console.error('❌ Payment failed via WebSocket:', event);
        this.snackbar.open(`Plată eșuată: ${event.reason}`, undefined, { duration: 5000 });
      },
      error: () => {
        // Ignore timeout on failure channel
      }
    });

    // Store both subscriptions for cleanup
    this.wsSubscription = new Subscription();
    this.wsSubscription.add(successSub);
    this.wsSubscription.add(failureSub);
  }

  private buildEnrollmentPayload(paymentMethod: 'CARD' | 'CASH'): EnrollmentRequest {
    const payload: EnrollmentRequest = {
      kind: this.kind,
      entityId: this.productIdOrSlug,
      childIds: this.selectedChildIds(),
      paymentMethod,
    };

    // Add session package size for courses only
    if (this.kind === 'COURSE') {
      payload.sessionPackageSize = this.paymentForm.value.sessionPackageSize ?? 10;
    }

    // Attach billing details (PF) for card payments
    if (paymentMethod === 'CARD') {
      payload.billingDetails = {
        name: this.billingForm.value.name!,
        email: this.billingForm.value.email!,
        addressLine1: this.billingForm.value.addressLine1!,
        city: this.billingForm.value.city!,
        postalCode: this.billingForm.value.postalCode!,
      };
    }

    return payload;
  }

  private fetchProduct(kind: 'COURSE' | 'CAMP' | 'ACTIVITY', idOrSlug: string) {
    if (kind === 'COURSE') {
      return this.publicApi.getCourse(idOrSlug).pipe(
        map((course) => ({
          id: course.id,
          name: course.name,
          price: course.price,
          // Fallback to monthly price if pricePerSession is not provided by API
          pricePerSession: course.pricePerSession ?? course.price,
          currency: course.currency,
          allowCash: true,
        })),
      );
    }
    if (kind === 'ACTIVITY') {
      return this.publicApi.getActivity(idOrSlug).pipe(
        map((activity) => ({
          id: activity.id,
          name: activity.name,
          price: activity.price,
          currency: activity.currency,
          allowCash: true, // Activities allow cash by default
        })),
      );
    }
    return this.publicApi.getCampBySlug(idOrSlug).pipe(
      map((camp) => ({
        id: camp.id,
        name: camp.title,
        price: camp.price,
        currency: camp.currency,
        allowCash: camp.allowCash,
      })),
    );
  }

  private cancelCardMountTimer(): void {
    if (this.cardMountTimer) {
      clearTimeout(this.cardMountTimer);
      this.cardMountTimer = null;
    }
    this.cardMountAttempts = 0;
  }

  private teardownCardElement(): void {
    this.cancelCardMountTimer();
    if (!this.cardElement) {
      return;
    }
    try {
      // Unmount first; then destroy so future mounts always start clean
      this.cardElement.unmount();
    } catch {
      // ignore
    }
    try {
      (this.cardElement as any).destroy?.();
    } catch {
      // ignore
    }
    this.cardElement = undefined;
  }

  private scheduleEnsureCardMounted(): void {
    // Ensure view has time to render the *ngIf host before mounting
    this.cancelCardMountTimer();
    this.cardMountTimer = setTimeout(() => {
      void this.ensureCardMounted();
    }, 0);
  }

  private async ensureCardMounted(): Promise<void> {
    if (this.paymentForm.controls.method.value !== 'CARD') {
      return;
    }

    // Stripe init is async; if user got here fast, wait for it.
    if (!this.stripe) {
      await this.loadStripe();
      if (!this.stripe) {
        return;
      }
    }

    // Host is behind *ngIf; it may not exist yet on the same tick.
    const host = this.cardElementRef?.nativeElement;
    if (!host || !host.isConnected) {
      if (this.cardMountAttempts >= 10) {
        return;
      }
      this.cardMountAttempts += 1;
      this.cancelCardMountTimer();
      this.cardMountTimer = setTimeout(() => {
        void this.ensureCardMounted();
      }, 50);
      return;
    }

    if (!this.elements) {
      this.elements = this.stripe.elements();
    }

    if (!this.cardElement) {
      this.cardElement = this.elements.create('card');
    }

    // Avoid leaving stale iframes in the container when host is recreated
    host.innerHTML = '';

    try {
      this.cardElement.mount(host);
    } catch (e) {
      // If mount fails due to prior internal state, reset and retry once
      this.teardownCardElement();
      this.elements = this.stripe.elements();
      this.cardElement = this.elements.create('card');
      host.innerHTML = '';
      this.cardElement.mount(host);
    }
  }

  private async loadStripe(): Promise<void> {
    const runtimeKey = (typeof window !== 'undefined' && (window as any)?.STRIPE_PUBLISHABLE_KEY)
      || (import.meta as any)?.env?.NG_APP_STRIPE_KEY
      || '';
    if (!runtimeKey) {
      console.warn('Stripe public key missing. Set NG_APP_STRIPE_KEY or STRIPE_PUBLISHABLE_KEY.');
      this.stripe = null;
      return;
    }
    if (this.currentStripeKey === runtimeKey && this.stripe) {
      return; // already initialized with this key
    }
    // Disable advanced fraud signals to prevent "Application not found" error from reCAPTCHA
    // This can be re-enabled once Stripe domain configuration is verified
    if (typeof window !== 'undefined') {
      (loadStripe as any).setLoadParameters?.({ advancedFraudSignals: false });
    }
    this.stripe = await loadStripe(runtimeKey);
    this.currentStripeKey = runtimeKey;
    if (!this.stripe) {
      console.warn('Stripe failed to initialize');
    } else {
      // Reset elements when key changes
      this.elements = undefined;
      this.cardElement?.unmount();
      this.cardElement = undefined;
    }
  }
}
