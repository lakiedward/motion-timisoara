import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, PLATFORM_ID, HostListener, AfterViewInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { PublicApiService, ContactMessageRequest } from '../../../core/services/public-api.service';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './contact-page.component.html',
  styleUrls: ['./contact-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactPageComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PublicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private intersectionObserver?: IntersectionObserver;

  readonly contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    subject: [''],
    message: ['', [Validators.required, Validators.minLength(10)]]
  });

  readonly submissionState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  scrollProgress = 0;

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.setupScrollReveal();

      // Re-observe elements after content loads
      setTimeout(() => {
        this.refreshScrollReveal();
      }, 500);
    }
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;

    const scrollY = window.scrollY;
    const documentElement = document.documentElement;
    const maxScroll = documentElement.scrollHeight - window.innerHeight;

    if (maxScroll > 0) {
      this.scrollProgress = Math.min(100, Math.max(0, (scrollY / maxScroll) * 100));
    } else {
      this.scrollProgress = 0;
    }
  }

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.submissionState.set('error');
      return;
    }

    const { name, email, subject, message } = this.contactForm.value;
    const payload: ContactMessageRequest = {
      name: (name ?? '').trim(),
      email: (email ?? '').trim(),
      subject: subject?.trim() || undefined,
      message: (message ?? '').trim()
    };

    this.submissionState.set('loading');

    this.api
      .submitContact(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submissionState.set('success');
          this.contactForm.reset();
          this.contactForm.markAsPristine();
        },
        error: () => {
          this.submissionState.set('error');
        }
      });
  }

  hasError(controlName: 'name' | 'email' | 'message'): boolean {
    const control = this.contactForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  /**
   * Scrolls smoothly to the contact form section.
   */
  scrollToForm(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isBrowser) {
      const formSection = document.getElementById('contact-form');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  private setupScrollReveal(): void {
    if (!this.isBrowser) return;

    setTimeout(() => {
      const observerOptions: IntersectionObserverInit = {
        threshold: 0.05,
        rootMargin: '0px 0px -20px 0px'
      };

      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      }, observerOptions);

      const revealElements = document.querySelectorAll('.scroll-reveal');
      revealElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

        if (isInViewport) {
          el.classList.add('revealed');
        }

        this.intersectionObserver?.observe(el);
      });
    }, 100);
  }

  private refreshScrollReveal(): void {
    if (!this.isBrowser || !this.intersectionObserver) return;

    const revealElements = document.querySelectorAll('.scroll-reveal:not(.revealed)');
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        el.classList.add('revealed');
      }

      this.intersectionObserver?.observe(el);
    });
  }
}
