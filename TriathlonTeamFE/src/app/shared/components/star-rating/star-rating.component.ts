import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.scss']
})
export class StarRatingComponent {
  @Input() rating: number = 0;
  @Input() readonly: boolean = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Output() ratingChange = new EventEmitter<number>();

  hoveredRating: number = 0;
  stars: number[] = [1, 2, 3, 4, 5];

  onStarClick(star: number): void {
    if (!this.readonly) {
      this.rating = star;
      this.ratingChange.emit(star);
    }
  }

  onStarHover(star: number): void {
    if (!this.readonly) {
      this.hoveredRating = star;
    }
  }

  onMouseLeave(): void {
    this.hoveredRating = 0;
  }

  getStarClass(star: number): string {
    const displayRating = this.hoveredRating || this.rating;
    
    if (displayRating >= star) {
      return 'star--full';
    } else if (displayRating >= star - 0.5) {
      return 'star--half';
    } else {
      return 'star--empty';
    }
  }

  getStarIcon(star: number): string {
    const displayRating = this.hoveredRating || this.rating;
    
    if (displayRating >= star) {
      return '★';
    } else if (displayRating >= star - 0.5) {
      return '⯨';
    } else {
      return '☆';
    }
  }
}



