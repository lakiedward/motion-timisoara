import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SportService } from '../../services/sport.service';
import { Sport, CreateSportRequest, UpdateSportRequest } from '../../services/models/sport.model';

@Component({
  selector: 'app-sport-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './sport-dialog.component.html',
  styleUrls: ['./sport-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SportDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<SportDialogComponent, boolean>);
  private readonly sportService = inject(SportService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sport = inject<Sport | null>(MAT_DIALOG_DATA, { optional: true });

  form!: FormGroup;
  readonly isSubmitting = signal(false);
  readonly isEditMode = signal(false);
  readonly codePreview = signal('');

  ngOnInit(): void {
    this.isEditMode.set(!!this.sport);

    this.form = this.fb.group({
      name: [this.sport?.name || '', [Validators.required, Validators.minLength(2)]]
    });

    // Live preview for generated code (shown in UI)
    const initialName = String(this.form.get('name')?.value ?? '');
    this.codePreview.set(this.generateCodeFromName(initialName));
    this.form
      .get('name')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.codePreview.set(this.generateCodeFromName(String(value ?? '')));
      });
  }

  /**
   * Generează un cod din nume (lowercase, fără diacritice, fără spații)
   */
  private generateCodeFromName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // elimină diacritice
      .replace(/\s+/g, '_') // înlocuiește spații cu underscore
      .replace(/[^a-z0-9_]/g, ''); // elimină caractere speciale
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.form.getRawValue();
    const generatedCode = this.generateCodeFromName(formValue.name);

    if (this.isEditMode() && this.sport) {
      const payload: UpdateSportRequest = {
        code: generatedCode,
        name: formValue.name
      };

      this.sportService
        .updateSport(this.sport.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.dialogRef.close(true);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.form.setErrors({ submit: true });
          }
        });
    } else {
      const payload: CreateSportRequest = {
        code: generatedCode,
        name: formValue.name
      };

      this.sportService
        .createSport(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.dialogRef.close(true);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.form.setErrors({ submit: true });
          }
        });
    }
  }

  cancel(): void {
    if (!this.isSubmitting()) {
      this.dialogRef.close(false);
    }
  }
}

