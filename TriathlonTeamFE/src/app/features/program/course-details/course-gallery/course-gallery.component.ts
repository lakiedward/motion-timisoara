import { Component, Input, signal, computed, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

@Component({
  selector: 'app-course-gallery',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './course-gallery.component.html',
  styleUrls: ['./course-gallery.component.scss']
})
export class CourseGalleryComponent {
  @Input() gallery: string[] = [];
  @Input() heroPhotoUrl?: string;
  @Input() courseName: string = '';

  private readonly apiBaseUrl = inject<string>(API_BASE_URL);

  readonly currentIndex = signal(0);
  
  readonly currentImage = computed(() => {
    const allImages = this.getAllImages();
    const index = this.currentIndex();
    return allImages[index] || allImages[0];
  });

  readonly hasImages = computed(() => this.getAllImages().length > 0);
  readonly imageCount = computed(() => this.getAllImages().length);
  readonly currentImageNumber = computed(() => this.currentIndex() + 1);
  readonly canGoPrevious = computed(() => this.currentIndex() > 0);
  readonly canGoNext = computed(() => this.currentIndex() < this.imageCount() - 1);

  getAllImages(): string[] {
    // Only show gallery images, exclude hero photo as it's already shown in hero section
    const images = [...this.gallery];
    return images.map((url) => this.resolveUrl(url));
  }

  private resolveUrl(url: string): string {
    if (!url) return url;
    // If already absolute, return as is
    if (/^https?:\/\//i.test(url)) return url;

    // Ensure base URL has no trailing slash
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    if (!base) return url; // fallback to original relative (same-origin)

    // Ensure URL starts with a slash
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  goToPrevious(): void {
    if (this.canGoPrevious()) {
      this.currentIndex.set(this.currentIndex() - 1);
    }
  }

  goToNext(): void {
    if (this.canGoNext()) {
      this.currentIndex.set(this.currentIndex() + 1);
    }
  }

  goToImage(index: number): void {
    const maxIndex = this.imageCount() - 1;
    if (index >= 0 && index <= maxIndex) {
      this.currentIndex.set(index);
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.goToPrevious();
    } else if (event.key === 'ArrowRight') {
      this.goToNext();
    }
  }

  getImageAlt(index: number): string {
    return `${this.courseName} - Imagine ${index + 1}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Don't hide the image, just log the error for debugging
    console.warn('Failed to load image:', img.src);
    // Optionally show a placeholder icon instead
    img.style.opacity = '0.3';
  }

  trackByIndex(index: number, item: string): number {
    return index;
  }
}
