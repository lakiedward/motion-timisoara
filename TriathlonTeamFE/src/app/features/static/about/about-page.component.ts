import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, OnDestroy, HostListener, AfterViewInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.scss']
})
export class AboutPageComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private intersectionObserver?: IntersectionObserver;
  
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
