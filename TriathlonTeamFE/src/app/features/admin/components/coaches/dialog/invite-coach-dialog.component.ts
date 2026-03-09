import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, DestroyRef } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { FormBuilder } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, InviteCoachPayload } from '../../../services/admin-api.service';

@Component({
  selector: 'app-invite-coach-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './invite-coach-dialog.component.html',
  styleUrls: ['./invite-coach-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteCoachDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly dialogRef = inject(MatDialogRef<InviteCoachDialogComponent, boolean>);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    bio: [''],
    sports: this.fb.nonNullable.array(
      ['swim', 'bike', 'run'].map(() => false),
      this.requireAtLeastOne(),
    ),
  });

  readonly isSubmitting = signal(false);
  readonly sportOptions = ['swim', 'bike', 'run'];

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const selectedSports = this.form.controls.sports.controls
      .map((control, index) => (control.value ? this.sportOptions[index] : null))
      .filter((value): value is string => value !== null);

    const payload: InviteCoachPayload = {
      name: this.form.value.name!,
      email: this.form.value.email!,
      phone: this.form.value.phone!,
      bio: this.form.value.bio ?? '',
      sports: selectedSports,
    };

    this.isSubmitting.set(true);
    this.api
      .inviteCoach(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackbar.open('Nu am putut trimite invitatia', undefined, { duration: 4000 });
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private requireAtLeastOne() {
    return (array: any) => {
      return array.controls.some((ctrl: any) => ctrl.value === true) ? null : { required: true };
    };
  }
}
