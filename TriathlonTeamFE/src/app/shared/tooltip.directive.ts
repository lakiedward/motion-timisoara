import { Directive, ElementRef, HostListener, Input, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input() appTooltip: string = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  
  private tooltipElement: HTMLElement | null = null;
  private showTimeout: number | null = null;
  private hideTimeout: number | null = null;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.appTooltip && !this.tooltipElement) {
      this.showTimeout = window.setTimeout(() => {
        this.showTooltip();
      }, 500); // 500ms delay before showing
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    
    this.hideTimeout = window.setTimeout(() => {
      this.hideTooltip();
    }, 100); // 100ms delay before hiding
  }

  @HostListener('mouseenter', ['$event'])
  onTooltipMouseEnter(event: Event): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  @HostListener('mouseleave', ['$event'])
  onTooltipMouseLeave(event: Event): void {
    this.hideTimeout = window.setTimeout(() => {
      this.hideTooltip();
    }, 100);
  }

  private showTooltip(): void {
    if (!this.appTooltip || this.tooltipElement) return;

    // Create tooltip element
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltipElement, 'custom-tooltip');
    this.renderer.addClass(this.tooltipElement, `custom-tooltip--${this.tooltipPosition}`);
    this.renderer.setProperty(this.tooltipElement, 'textContent', this.appTooltip);

    // Append to body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Position the tooltip
    this.positionTooltip();

    // Add event listeners to tooltip element
    this.renderer.listen(this.tooltipElement, 'mouseenter', (event) => {
      this.onTooltipMouseEnter(event);
    });
    this.renderer.listen(this.tooltipElement, 'mouseleave', (event) => {
      this.onTooltipMouseLeave(event);
    });

    // Trigger fade-in animation
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.addClass(this.tooltipElement, 'custom-tooltip--visible');
      }
    }, 10);
  }

  private hideTooltip(): void {
    if (!this.tooltipElement) return;

    this.renderer.removeClass(this.tooltipElement, 'custom-tooltip--visible');
    
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.removeChild(document.body, this.tooltipElement);
        this.tooltipElement = null;
      }
    }, 200); // Match transition duration
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let top: number;
    let left: number;

    switch (this.tooltipPosition) {
      case 'top':
        top = hostRect.top + scrollY - tooltipRect.height - 8;
        left = hostRect.left + scrollX + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + scrollY + 8;
        left = hostRect.left + scrollX + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + scrollY + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left + scrollX - tooltipRect.width - 8;
        break;
      case 'right':
        top = hostRect.top + scrollY + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + scrollX + 8;
        break;
      default:
        top = hostRect.top + scrollY - tooltipRect.height - 8;
        left = hostRect.left + scrollX + (hostRect.width - tooltipRect.width) / 2;
    }

    // Adjust for viewport boundaries
    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }

    if (top < 8) {
      top = 8;
    } else if (top + tooltipRect.height > viewportHeight + scrollY - 8) {
      top = viewportHeight + scrollY - tooltipRect.height - 8;
    }

    this.renderer.setStyle(this.tooltipElement, 'position', 'absolute');
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltipElement, 'z-index', '9999');
  }

  ngOnDestroy(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
    }
  }
}






