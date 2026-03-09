import {
  Directive,
  ElementRef,
  Input,
  Renderer2,
  HostListener,
  inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {
  private readonly elementRef = inject(ElementRef<HTMLImageElement>);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @Input() appImageFallback = '/ui/IMG_20240415_163244.jpg'; // Default fallback image
  @Input() showLoadingClass = true;

  private hasError = false;

  @HostListener('load')
  onLoad(): void {
    if (!this.isBrowser || this.hasError) {
      return;
    }

    const img = this.elementRef.nativeElement;

    // Add loaded class for fade-in animation
    if (this.showLoadingClass) {
      this.renderer.addClass(img, 'loaded');
    }
  }

  @HostListener('error')
  onError(): void {
    if (!this.isBrowser || this.hasError) {
      return;
    }

    this.hasError = true;
    const img = this.elementRef.nativeElement;

    // Set fallback image
    this.renderer.setAttribute(img, 'src', this.appImageFallback);

    // Add error class for styling
    this.renderer.addClass(img, 'image-error');

    // Still add loaded class to prevent infinite loading state
    if (this.showLoadingClass) {
      this.renderer.addClass(img, 'loaded');
    }

    console.warn('Image failed to load, using fallback:', this.appImageFallback);
  }
}
