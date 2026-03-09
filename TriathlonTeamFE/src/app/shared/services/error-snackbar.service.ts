import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ErrorSnackbarService {
  private readonly snackBar = inject(MatSnackBar);

  show(message: string): void {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;
    this.snackBar.open(message, undefined, {
      duration: 5000,
      horizontalPosition: isMobile ? 'center' : 'right',
      verticalPosition: isMobile ? 'bottom' : 'top',
      panelClass: ['error-snackbar']
    });
  }
}
