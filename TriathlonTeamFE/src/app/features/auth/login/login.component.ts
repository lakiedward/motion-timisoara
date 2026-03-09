import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  DestroyRef,
  OnInit,
  Inject,
  PLATFORM_ID,
  afterNextRender
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorSnackbarService } from '../../../shared/services/error-snackbar.service';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatIconModule, FormErrorComponent, GoogleSigninButtonComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly isSubmitting = signal(false);
  readonly authError = signal<string | null>(null);
  scrollProgress = 0;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.initScrollProgress();
        this.initScrollReveal();
      });
    }
  }

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.authError()) {
          this.authError.set(null);
        }
      });
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.authError.set(null);
    this.isSubmitting.set(true);
    this.authService
      .login(this.form.getRawValue())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: () => this.navigateAfterLogin(),
        error: (error) => this.handleError(error)
      });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.authError.set('Email sau parola sunt greșite.');
        return;
      }
      if (error.status === 400) {
        const message = this.resolveLoginErrorMessage(error);
        this.authError.set(message);
        return;
      }
    }
    this.snackbar.show('Nu am putut realiza autentificarea. Incearca din nou.');
  }

  private resolveLoginErrorMessage(error: HttpErrorResponse): string {
    const payload = error.error as unknown;

    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    if (payload && typeof payload === 'object') {
      const maybeMessage = (payload as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage.trim();
      }
    }

    return 'Email sau parola sunt greșite.';
  }

  private navigateAfterLogin(): void {
    const params = this.route.snapshot.queryParamMap;
    const redirect = params.get('redirect') ?? params.get('returnUrl');
    if (redirect) {
      const extras = new URLSearchParams();
      params.keys.forEach((key) => {
        if (key === 'redirect' || key === 'returnUrl') {
          return;
        }
        const value = params.get(key);
        if (value !== null) {
          extras.append(key, value);
        }
      });
      const queryString = extras.toString();
      const target = queryString
        ? `${redirect}${redirect.includes('?') ? '&' : '?'}${queryString}`
        : redirect;
      void this.router.navigateByUrl(target);
      return;
    }

    const user = this.authService.getCurrentUser();
    let target = '/account';
    if (user?.role === 'ADMIN') target = '/admin';
    else if (user?.role === 'CLUB') target = '/club';
    else if (user?.role === 'COACH') target = '/coach';
    void this.router.navigate([target]);
  }

  private initScrollProgress(): void {
    fromEvent(window, 'scroll')
      .pipe(debounceTime(10), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        this.scrollProgress = height > 0 ? (winScroll / height) * 100 : 0;
      });
  }

  private initScrollReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      observer.observe(el);
    });
  }

  get googleRedirectTarget(): string {
    const params = this.route.snapshot.queryParamMap;
    const candidate = params.get('redirect') ?? params.get('returnUrl');
    if (candidate && candidate.startsWith('/')) {
      return candidate;
    }
    return '/account';
  }
}
