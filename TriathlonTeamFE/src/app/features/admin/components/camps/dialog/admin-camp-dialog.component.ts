import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminApiService,
  AdminCampPayload,
  AdminCampSummary,
} from '../../../services/admin-api.service';

@Component({
  selector: 'app-admin-camp-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './admin-camp-dialog.component.html',
  styleUrls: ['./admin-camp-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCampDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly dialogRef = inject(MatDialogRef<AdminCampDialogComponent, boolean>);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    location: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    currency: ['RON', Validators.required],
    allowCash: [false],
    description: [''],
  });

  readonly isSubmitting = signal(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: AdminCampSummary | null) {}

  ngOnInit(): void {
    if (this.data) {
      this.form.patchValue({
        title: this.data.title,
        price: this.data.price,
        currency: this.data.currency,
        allowCash: this.data.allowCash,
      });
    }
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: AdminCampPayload = {
      title: this.form.value.title!,
      startDate: this.form.value.startDate!,
      endDate: this.form.value.endDate!,
      location: this.form.value.location!,
      price: this.form.value.price!,
      currency: this.form.value.currency!,
      allowCash: this.form.value.allowCash ?? false,
      description: this.form.value.description ?? '',
    };

    this.isSubmitting.set(true);
    this.api
      .saveCamp(this.data?.id ?? null, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackbar.open('Nu am putut salva tabara', undefined, { duration: 4000 });
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
