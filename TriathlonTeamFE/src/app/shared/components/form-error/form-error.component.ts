import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface ErrorMessage {
  [key: string]: string;
}

@Component({
  selector: 'app-form-error',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="form-error" *ngIf="shouldShowError()">
      {{ getErrorMessage() }}
    </div>
  `,
  styles: [`
    .form-error {
      color: #dc2626;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      display: block;
    }
  `]
})
export class FormErrorComponent {
  @Input() control: AbstractControl | null = null;
  @Input() errorMessages: ErrorMessage = {};

  private readonly defaultErrorMessages: ErrorMessage = {
    required: 'Acest câmp este obligatoriu.',
    email: 'Introdu un email valid.',
    minlength: 'Trebuie să aibă minim {{requiredLength}} caractere.',
    maxlength: 'Trebuie să aibă maxim {{requiredLength}} caractere.',
    min: 'Valoarea minimă este {{min}}.',
    max: 'Valoarea maximă este {{max}}.',
    pattern: 'Format invalid.'
  };

  shouldShowError(): boolean {
    if (!this.control) {
      return false;
    }

    return this.control.invalid && (this.control.dirty || this.control.touched);
  }

  getErrorMessage(): string {
    if (!this.control || !this.control.errors) {
      return '';
    }

    // Get the first error key
    const errorKey = Object.keys(this.control.errors)[0];

    // Check for custom error message
    if (this.errorMessages[errorKey]) {
      return this.interpolateErrorMessage(this.errorMessages[errorKey], this.control.errors[errorKey]);
    }

    // Use default error message
    if (this.defaultErrorMessages[errorKey]) {
      return this.interpolateErrorMessage(this.defaultErrorMessages[errorKey], this.control.errors[errorKey]);
    }

    // Fallback
    return 'Valoare invalidă.';
  }

  private interpolateErrorMessage(message: string, errorValue: any): string {
    // Handle minlength/maxlength special cases
    if (errorValue?.requiredLength) {
      return message.replace('{{requiredLength}}', errorValue.requiredLength);
    }

    // Handle min/max special cases
    if (errorValue?.min !== undefined) {
      return message.replace('{{min}}', errorValue.min);
    }

    if (errorValue?.max !== undefined) {
      return message.replace('{{max}}', errorValue.max);
    }

    return message;
  }
}
