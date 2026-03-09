import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Child, ChildPayload } from '../../services/children.service';

export interface ChildFormData {
  mode: 'create' | 'edit';
  child?: Child;
}

@Component({
  selector: 'app-child-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './child-form.component.html',
  styleUrls: ['./child-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChildFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ChildFormComponent, ChildPayload>);

  constructor(@Inject(MAT_DIALOG_DATA) public data: ChildFormData) { }

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    birthDate: this.fb.nonNullable.control('', Validators.required),
    allergies: this.fb.control<string | null>(null),
    emergencyContactName: this.fb.control<string | null>(null),
    emergencyPhone: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9+ ]{6,20}$/)])
  });

  ngOnInit(): void {
    if (this.data.child) {
      const child = this.data.child;
      this.form.patchValue({
        name: child.name,
        birthDate: child.birthDate ?? '',
        allergies: child.allergies ?? '',
        emergencyContactName: child.emergencyContactName ?? '',
        emergencyPhone: child.emergencyPhone ?? ''
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: ChildPayload = {
      name: this.form.controls.name.value.trim(),
      birthDate: this.form.controls.birthDate.value,
      allergies: this.form.controls.allergies.value?.trim() || undefined,
      emergencyContactName: this.form.controls.emergencyContactName.value?.trim() || undefined,
      emergencyPhone: this.form.controls.emergencyPhone.value.trim()
    };

    this.dialogRef.close(payload);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
