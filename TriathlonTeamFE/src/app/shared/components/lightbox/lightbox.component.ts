import { CommonModule, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, signal, inject, Renderer2, OnDestroy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [CommonModule, NgIf, MatIconModule],
  templateUrl: './lightbox.component.html',
  styleUrls: ['./lightbox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LightboxComponent implements OnChanges, OnDestroy {
  private renderer = inject(Renderer2);

  @Input() images: string[] = [];
  @Input() open = false;
  @Input() initialIndex = 0;
  @Output() closed = new EventEmitter<void>();

  readonly index = signal(0);
  
  // Touch handling state
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private readonly SWIPE_THRESHOLD = 50;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialIndex']) {
      const i = Number(this.initialIndex) || 0;
      this.index.set(Math.min(Math.max(0, i), Math.max(0, this.images.length - 1)));
    }

    if (changes['open']) {
      if (this.open) {
        this.lockScroll();
      } else {
        this.unlockScroll();
      }
    }
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  private lockScroll(): void {
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }

  private unlockScroll(): void {
    this.renderer.removeStyle(document.body, 'overflow');
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.open) return;
    
    switch(e.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowRight':
        this.next();
        break;
      case 'ArrowLeft':
        this.prev();
        break;
    }
  }

  // Touch Events for Swipe
  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0].screenX;
    this.touchStartY = e.changedTouches[0].screenY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    this.touchEndX = e.changedTouches[0].screenX;
    this.touchEndY = e.changedTouches[0].screenY;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const diffX = this.touchEndX - this.touchStartX;
    const diffY = this.touchEndY - this.touchStartY;
    
    // Check for vertical swipe (close)
    if (Math.abs(diffY) > this.SWIPE_THRESHOLD && Math.abs(diffY) > Math.abs(diffX)) {
      this.close();
      return;
    }

    // Check for horizontal swipe (navigation)
    if (Math.abs(diffX) > this.SWIPE_THRESHOLD && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        this.prev(); // Swipe Right -> Prev
      } else {
        this.next(); // Swipe Left -> Next
      }
    }
  }

  close(): void {
    this.closed.emit();
  }

  prev(e?: Event): void {
    e?.stopPropagation();
    if (!this.images.length) return;
    const i = this.index();
    this.index.set((i - 1 + this.images.length) % this.images.length);
  }

  next(e?: Event): void {
    e?.stopPropagation();
    if (!this.images.length) return;
    const i = this.index();
    this.index.set((i + 1) % this.images.length);
  }
}
