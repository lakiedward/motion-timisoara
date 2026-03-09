import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  ElementRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, fromEvent } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorSnackbarService } from '../../../shared/services/error-snackbar.service';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatIconModule, FormErrorComponent, GoogleSigninButtonComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject(ElementRef);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]]
  });

  readonly isSubmitting = signal(false);
  scrollProgress = 0;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initScrollEffects();
      this.initScrollReveal();
    }
  }

  private initScrollEffects(): void {
    fromEvent(window, 'scroll')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateScrollProgress();
      });
  }

  private updateScrollProgress(): void {
    const winScroll = window.scrollY;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.scrollProgress = height > 0 ? (winScroll / height) * 100 : 0;
  }

  private initScrollReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.renderer.addClass(entry.target, 'revealed');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = this.elementRef.nativeElement.querySelectorAll('.scroll-reveal');
    elements.forEach((el: Element) => observer.observe(el));
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.authService
      .registerParent(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.navigateAfterRegister(),
        error: (error) => this.handleError(error)
      });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 401)) {
      return;
    }
    this.snackbar.show('Nu am putut crea contul. Verifica datele si incearca din nou.');
  }

  private navigateAfterRegister(): void {
    const params = this.route.snapshot.queryParamMap;
    const redirect = params.get('redirect');
    if (redirect) {
      const extras = new URLSearchParams();
      params.keys.forEach((key) => {
        if (key === 'redirect') {
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

    void this.router.navigate(['/account']);
  }

  get googleRedirectTarget(): string {
    const params = this.route.snapshot.queryParamMap;
    const candidate = params.get('redirect');
    if (candidate && candidate.startsWith('/')) {
      return candidate;
    }
    return '/account';
  }
}
