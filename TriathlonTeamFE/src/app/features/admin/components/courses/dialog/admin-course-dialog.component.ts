import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit, inject, signal, DestroyRef } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminApiService,
  AdminCoach,
  AdminCourseSummary,
} from '../../../services/admin-api.service';
import { SportService } from '../../../services/sport.service';
import { Sport } from '../../../services/models/sport.model';

interface AdminCourseDialogData extends Partial<AdminCourseSummary> {
  ageFrom?: number;
  ageTo?: number;
  price?: number;
  days?: number[];
  startTime?: string;
  endTime?: string;
}

@Component({
  selector: 'app-admin-course-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './admin-course-dialog.component.html',
  styleUrls: ['./admin-course-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCourseDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly sportService = inject(SportService);
  private readonly dialogRef = inject(MatDialogRef<AdminCourseDialogComponent, boolean>);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly coaches = signal<AdminCoach[]>([]);
  readonly sports = signal<{ label: string; value: string }[]>([]);
  readonly sportsLoading = signal(true);
  readonly isSubmitting = signal(false);

  readonly weekDays = [
    { label: 'L', value: 1 },
    { label: 'Ma', value: 2 },
    { label: 'Mi', value: 3 },
    { label: 'J', value: 4 },
    { label: 'V', value: 5 },
    { label: 'S', value: 6 },
    { label: 'D', value: 7 },
  ];

  readonly form = this.fb.nonNullable.group(
    {
      coachId: ['', Validators.required],
      name: ['', [Validators.required, Validators.minLength(3)]],
      sport: ['', Validators.required],
      level: ['incepator', Validators.required],
      ageFrom: [6, [Validators.min(3)]],
      ageTo: [12, [Validators.min(3)]],
      days: this.fb.array(
        this.weekDays.map(() => false),
        [this.atLeastOneDaySelected()],
      ),
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      capacity: [10, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]],
    },
    { validators: this.validAgeRange() },
  );

  constructor(@Inject(MAT_DIALOG_DATA) public data: AdminCourseDialogData | null) {}

  ngOnInit(): void {
    this.loadCoaches();
    this.loadSports();
    if (this.data) {
      this.form.patchValue({
        coachId: this.data.coachId ?? '',
        name: this.data.name ?? '',
        sport: this.data.sport ?? 'swim',
        level: this.data.level ?? 'beginner',
        ageFrom: this.data.ageFrom ?? 6,
        ageTo: this.data.ageTo ?? 12,
        startTime: this.data.startTime ?? '',
        endTime: this.data.endTime ?? '',
        capacity: this.data.capacity ?? 10,
        price: this.data.price ?? 0,
      });
      if (this.data.days?.length) {
        this.data.days.forEach((day) => {
          const index = this.weekDays.findIndex((option) => option.value === day);
          if (index >= 0) {
            this.daysArray.at(index).setValue(true);
          }
        });
      }
    }
  }

  get daysArray(): FormArray {
    return this.form.controls.days as FormArray;
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const selectedDays = this.daysArray.controls
      .map((control, index) => (control.value ? this.weekDays[index].value : null))
      .filter((value): value is number => value !== null);

    const payload: Partial<AdminCourseSummary> & {
      coachId: string;
      level?: string;
      sport?: string;
      ageFrom?: number | null;
      ageTo?: number | null;
      days?: number[];
      startTime?: string;
      endTime?: string;
      price?: number;
      capacity?: number;
      scheduleSummary?: string;
    } = {
      coachId: this.form.value.coachId!,
      name: this.form.value.name!,
      sport: this.form.value.sport!,
      level: this.form.value.level!,
      ageFrom: this.form.value.ageFrom ?? null,
      ageTo: this.form.value.ageTo ?? null,
      days: selectedDays,
      startTime: this.form.value.startTime!,
      endTime: this.form.value.endTime!,
      capacity: this.form.value.capacity!,
      price: this.form.value.price!,
      scheduleSummary: this.buildScheduleSummary(
        selectedDays,
        this.form.value.startTime!,
        this.form.value.endTime!,
      ),
    };

    this.isSubmitting.set(true);
    const courseId = this.data?.id ?? null;
    this.api
      .saveCourse(courseId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackbar.open('Nu am putut salva cursul', undefined, { duration: 4000 });
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private loadCoaches(): void {
    this.api
      .getCoaches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coaches) => this.coaches.set(coaches),
        error: () => this.coaches.set([]),
      });
  }

  private loadSports(): void {
    this.sportsLoading.set(true);

    this.sportService
      .getSports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => {
          const sportOptions = (sports ?? []).map((sport: Sport) => ({
            label: sport.name,
            value: sport.code
          }));
          this.sports.set(sportOptions);
          this.sportsLoading.set(false);
        },
        error: () => {
          this.sportsLoading.set(false);
          // Fallback la sporturi hardcodate dacă API-ul nu este disponibil
          const fallbackSports = [
            { label: 'Inot', value: 'inot' },
            { label: 'Ciclism', value: 'ciclism' },
            { label: 'Alergare', value: 'alergare' },
            { label: 'Triatlon', value: 'triatlon' },
            { label: 'Fitness', value: 'fitness' }
          ];
          this.sports.set(fallbackSports);
        }
      });
  }

  private buildScheduleSummary(days: number[], start: string, end: string): string {
    if (!days.length || !start || !end) {
      return '';
    }
    const dayLabels = days
      .map((day) => this.weekDays.find((option) => option.value === day)?.label)
      .filter((label): label is string => !!label)
      .join(', ');
    return `${dayLabels} ${start}-${end}`;
  }

  private atLeastOneDaySelected(): ValidatorFn {
    return (control: AbstractControl) => {
      const formArray = control as FormArray;
      return formArray.controls.some((ctrl) => ctrl.value === true) ? null : { noDay: true };
    };
  }

  private validAgeRange(): ValidatorFn {
    return (group: AbstractControl) => {
      const from = group.get('ageFrom')?.value;
      const to = group.get('ageTo')?.value;
      if (from == null || to == null) {
        return null;
      }
      return from <= to ? null : { ageRange: true };
    };
  }
}
