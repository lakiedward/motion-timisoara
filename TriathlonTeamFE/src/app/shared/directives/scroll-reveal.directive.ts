import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  Renderer2
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appScrollReveal]',
  standalone: true
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private observer?: IntersectionObserver;

  @Input() scrollRevealThreshold = 0.05;
  @Input() scrollRevealRootMargin = '0px 0px -20px 0px';
  @Input() scrollRevealDelay = 0;
  @Input() scrollRevealScale = false;

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    // Add base scroll-reveal class
    this.renderer.addClass(this.elementRef.nativeElement, 'scroll-reveal');

    // Add scale variant if specified
    if (this.scrollRevealScale) {
      this.renderer.addClass(this.elementRef.nativeElement, 'scroll-reveal--scale');
    }

    // Add delay class if specified
    if (this.scrollRevealDelay > 0) {
      this.renderer.addClass(
        this.elementRef.nativeElement,
        `scroll-reveal--delay-${this.scrollRevealDelay}`
      );
    }

    // Setup intersection observer
    this.setupObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupObserver(): void {
    if (!this.isBrowser) {
      return;
    }

    const options: IntersectionObserverInit = {
      threshold: this.scrollRevealThreshold,
      rootMargin: this.scrollRevealRootMargin
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.renderer.addClass(entry.target, 'revealed');
          // Optionally unobserve after revealing (one-time animation)
          // this.observer?.unobserve(entry.target);
        }
      });
    }, options);

    // Check if element is already in viewport
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

    if (isInViewport) {
      // Reveal immediately if already visible
      this.renderer.addClass(this.elementRef.nativeElement, 'revealed');
    }

    // Start observing
    this.observer.observe(this.elementRef.nativeElement);
  }
}
