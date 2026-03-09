import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { CompleteProfileRequest } from '../../../core/models/auth';
import { ErrorSnackbarService } from '../../../shared/services/error-snackbar.service';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';

interface ProfileCompletionDialogData {
  name?: string | null;
  phone?: string | null;
}

@Component({
  selector: 'app-profile-completion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormErrorComponent,
  ],
  templateUrl: './profile-completion-dialog.component.html',
  styleUrls: ['./profile-completion-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCompletionDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ProfileCompletionDialogComponent>);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly data = inject<ProfileCompletionDialogData>(MAT_DIALOG_DATA);

  readonly form = this.fb.group({
    name: [this.data?.name ?? '', [Validators.required, Validators.minLength(3)]],
    phone: [this.data?.phone ?? '', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
  });

  readonly isSubmitting = signal(false);

  ngOnInit(): void {
    this.dialogRef.disableClose = true;
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const payload = this.form.getRawValue() as CompleteProfileRequest;

    this.authService
      .completeProfile(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (user) => this.dialogRef.close(user),
        error: () => {
          this.snackbar.show('Nu am putut salva datele. Incearca din nou.');
        },
      });
  }
}

