import { Component, ChangeDetectionStrategy, OnInit, inject, PLATFORM_ID, Renderer2, ElementRef, DestroyRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

@Component({
  selector: 'app-signup-choice',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './signup-choice.component.html',
  styleUrls: ['./signup-choice.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupChoiceComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initScrollReveal();
    }
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
}
