import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { RatingService } from '../../../core/services/rating.service';
import { RatingResponse } from '../../../core/models/rating.model';
import { catchError, of } from 'rxjs';

export interface RatingDialogData {
  entityType: 'course' | 'coach';
  entityId: string;
  entityName: string;
  existingRating?: RatingResponse;
}

@Component({
  selector: 'app-rating-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    StarRatingComponent
  ],
  templateUrl: './rating-dialog.component.html',
  styleUrls: ['./rating-dialog.component.scss']
})
export class RatingDialogComponent {
  rating: number = 0;
  comment: string = '';
  isSubmitting: boolean = false;
  error: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<RatingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RatingDialogData,
    private ratingService: RatingService
  ) {
    // Load existing rating if available
    if (data.existingRating) {
      this.rating = data.existingRating.rating;
      this.comment = data.existingRating.comment || '';
    }
  }

  onRatingChange(newRating: number): void {
    this.rating = newRating;
    this.error = null;
  }

  onSubmit(): void {
    if (this.rating < 1 || this.rating > 5) {
      this.error = 'Te rugăm să selectezi un rating între 1 și 5 stele.';
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    const request = {
      rating: this.rating,
      comment: this.comment.trim() || undefined
    };

    const ratingObservable = this.data.entityType === 'course'
      ? this.ratingService.rateCourse(this.data.entityId, request)
      : this.ratingService.rateCoach(this.data.entityId, request);

    ratingObservable
      .pipe(
        catchError((error) => {
          console.error('Error submitting rating:', error);
          // Extract error message from backend response
          if (error.error?.message) {
            this.error = error.error.message;
          } else if (error.status === 400) {
            this.error = 'Nu îndeplinești condițiile pentru a evalua. Asigură-te că ai un copil înscris.';
          } else {
            this.error = 'A apărut o eroare la salvarea ratingului. Te rugăm să încerci din nou.';
          }
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response) {
          this.dialogRef.close(response);
        }
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  get isUpdate(): boolean {
    return !!this.data.existingRating;
  }

  get dialogTitle(): string {
    if (this.isUpdate) {
      return this.data.entityType === 'course' ? 'Actualizează ratingul cursului' : 'Actualizează ratingul antrenorului';
    }
    return this.data.entityType === 'course' ? 'Evaluează cursul' : 'Evaluează antrenorul';
  }

  get submitButtonText(): string {
    return this.isUpdate ? 'Actualizează' : 'Trimite';
  }
}

