import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachCourseDetail, CoachService, CourseFormPayload } from '../../services/coach.service';
import { CoachApiService, CoachClub, CourseScheduleSlot } from '../../services/coach-api.service';
import { SportService } from '../../../admin/services/sport.service';
import { Sport } from '../../../admin/services/models/sport.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LocationPickerComponent } from '../../../../shared/components/location-picker/location-picker.component';
import { LocationDto } from '../../../../core/services/location.service';

interface Option {
  label: string;
  value: string;
}

interface DayFormValue {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-course-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatSelectModule, LocationPickerComponent],
  templateUrl: './course-form.component.html',
  styleUrls: ['./course-form.component.scss'],
  host: { '[class.course-form--compact]': 'compact' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly coachService = inject(CoachService);
  private readonly coachApiService = inject(CoachApiService);
  private readonly sportService = inject(SportService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  private readonly courseIdSignal = signal<string | null>(null);
  private currentLoadedId: string | null = null;
  private selectedLocationSnapshot: { id: string; name: string } | null = null;

  @Input() courseId?: string | null;
  @Input() externalSave = false;
  @Input() externalData = false;
  @Input() showHeader = true;
  @Input() compact = false;
  @Input() showClubPaymentSection = true;

  private readonly internalSaving = signal(false);
  private readonly externalSavingSignal = signal(false);
  readonly isSaving = computed(() => (this.externalSave ? this.externalSavingSignal() : this.internalSaving()));

  @Input()
  set externalSaving(value: boolean) {
    this.externalSavingSignal.set(value);
  }

  @Input()
  set externalLoading(value: boolean | null | undefined) {
    if (!this.externalData) {
      return;
    }
    if (value === null || value === undefined) {
      return;
    }
    this.isLoading.set(Boolean(value));
  }

  @Input()
  set externalLoadError(value: boolean | null | undefined) {
    if (!this.externalData) {
      return;
    }
    if (value === null || value === undefined) {
      return;
    }
    this.loadError.set(Boolean(value));
  }

  @Input()
  set externalCourse(value: CourseFormPayload | null | undefined) {
    if (!value) {
      return;
    }
    this.loadError.set(false);
    this.applyCoursePayload(value);
    if (this.externalData) {
      this.isLoading.set(false);
      this.currentLoadedId = this.courseIdSignal();
    }
  }

  @Output() submit = new EventEmitter<CourseFormPayload>();
  @Output() cancel = new EventEmitter<void>();

  readonly sports = signal<Option[]>([]);
  readonly sportsLoading = signal(true);
  readonly sportsLoadFailed = signal(false);

  readonly sportLabelMap = computed(() => {
    const sportsList = this.sports();
    return sportsList.reduce(
      (acc, option) => ({ ...acc, [option.value]: option.label }),
      {} as Record<string, string>
    );
  });

  readonly levels: Option[] = [
    { label: 'Incepator', value: 'incepator' },
    { label: 'Intermediar', value: 'intermediar' },
    { label: 'Avansat', value: 'avansat' }
  ];

  readonly levelLabelMap: Record<string, string> = this.levels.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<string, string>
  );

  readonly weekDays: Option[] = [
    { label: 'Luni', value: 'monday' },
    { label: 'Marti', value: 'tuesday' },
    { label: 'Miercuri', value: 'wednesday' },
    { label: 'Joi', value: 'thursday' },
    { label: 'Vineri', value: 'friday' },
    { label: 'Sambata', value: 'saturday' },
    { label: 'Duminica', value: 'sunday' }
  ];

  private readonly dayLabelMap: Record<string, string> = this.weekDays.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<string, string>
  );

  readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(3)]],
      sport: ['', Validators.required],
      level: ['', Validators.required],
      ageFrom: [8, [Validators.required, Validators.min(3)]],
      ageTo: [12, [Validators.required, Validators.min(3)]],
      locationId: ['', Validators.required],
      capacity: [10, [Validators.required, Validators.min(1)]],
      pricePerSession: [0, [Validators.required, Validators.min(1)]],
      packageOptions: [''],
      description: [''],
      schedule: this.fb.array<FormGroup>([]),
      // Club and payment settings
      clubId: [''],
      paymentRecipient: ['COACH' as 'COACH' | 'CLUB']
    },
    { validators: this.validateAgeRange() }
  );

  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly scheduleError = signal<string | null>(null);
  readonly selectedDayLabels = signal<string[]>([]);
  readonly schedulePreview = signal('Selecteaza zilele si intervalul orar.');
  
  // Clubs for payment settings
  readonly clubs = signal<CoachClub[]>([]);
  readonly clubsLoading = signal(true);
  readonly hasClubs = computed(() => this.clubs().length > 0);
  
  // Coach Stripe status
  readonly coachHasStripe = signal(false);

  readonly isEditMode = computed(() => this.courseIdSignal() !== null);

  readonly trackByDay = (_: number, control: FormGroup): string => (control.value as DayFormValue).day;

  get schedule(): FormArray<FormGroup> {
    return this.form.controls.schedule as FormArray<FormGroup>;
  }

  // Method to scroll selected option into view when dropdown opens
  onSelectOpened(): void {
    // Use setTimeout to wait for the dropdown to be rendered
    setTimeout(() => {
      const panel = document.querySelector('.mat-mdc-select-panel') as HTMLElement;
      const selectedOption = panel?.querySelector('.mat-mdc-option.mdc-list-item--selected') as HTMLElement;
      
      if (panel && selectedOption) {
        // Calculate scroll position to center the selected option
        const panelHeight = panel.clientHeight;
        const optionTop = selectedOption.offsetTop;
        const optionHeight = selectedOption.clientHeight;
        const scrollTo = optionTop - (panelHeight / 2) + (optionHeight / 2);
        
        panel.scrollTop = scrollTo;
      }
    }, 100); // Small delay to ensure dropdown is fully open
  }

  ngOnInit(): void {
    this.initializeScheduleControls();
    this.observeScheduleChanges();
    this.loadSports();

    // This form is reused in multiple contexts (coach/admin/club).
    // Club flow hides the "Club & Payments" section; in that case, skip coach-only endpoints
    // to avoid 403s (e.g. /api/coach/*).
    if (this.showClubPaymentSection) {
      this.loadClubs();
      this.loadCoachStripeStatus();
    }

    if (this.externalData) {
      return;
    }

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idFromRoute = params.get('id');
      if (idFromRoute) {
        this.setCourseId(idFromRoute);
      } else {
        this.courseIdSignal.set(null);
        this.currentLoadedId = null;
        this.isLoading.set(false);
        this.resetFormForCreate();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('courseId' in changes) {
      const newId = changes['courseId'].currentValue as string | null | undefined;
      if (newId) {
        this.setCourseId(newId);
      } else if (this.externalData) {
        this.courseIdSignal.set(null);
        this.currentLoadedId = null;
      }
    }
  }

  handleSubmit(): void {
    if (this.isSaving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.scheduleError.set('Completeaza toate campurile obligatorii.');
      return;
    }

    const selectedSlots = this.extractSelectedSlots();
    if (!selectedSlots.length) {
      this.scheduleError.set('Selecteaza cel putin o zi pentru curs si seteaza orele.');
      return;
    }

    const scheduleValidationError = this.validateSchedule(selectedSlots);
    if (scheduleValidationError) {
      this.scheduleError.set(scheduleValidationError);
      return;
    }

    this.scheduleError.set(null);

    const locationId = (this.form.value.locationId ?? '').toString().trim();
    const pricePerSession = Number(this.form.value.pricePerSession);
    const clubId = (this.form.value.clubId ?? '').toString().trim();
    const paymentRecipient = this.form.value.paymentRecipient as 'COACH' | 'CLUB';
    
    const payload: CourseFormPayload = {
      name: this.form.value.name!,
      sport: this.form.value.sport!,
      level: this.form.value.level!,
      ageFrom: Number(this.form.value.ageFrom),
      ageTo: Number(this.form.value.ageTo),
      locationId: locationId || undefined,
      capacity: Number(this.form.value.capacity),
      price: Math.round(pricePerSession * 100) * 8, // Convert RON to bani, then calculate monthly price (8 sessions)
      pricePerSession: Math.round(pricePerSession * 100), // Convert RON input to bani for backend
      packageOptions: this.form.value.packageOptions || undefined,
      description: this.form.value.description || undefined,
      schedule: selectedSlots,
      // Club and payment settings
      clubId: clubId || undefined,
      paymentRecipient: paymentRecipient
    };

    if (locationId) {
      if (this.selectedLocationSnapshot && this.selectedLocationSnapshot.id === locationId) {
        payload.locationName = this.selectedLocationSnapshot.name;
      }
    }

    if (this.externalSave) {
      this.submit.emit(payload);
      return;
    }

    this.internalSaving.set(true);
    const courseId = this.courseIdSignal();
    const save$ = courseId
      ? this.coachService.updateCourse(courseId, payload)
      : this.coachService.createCourse(payload);

    save$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (course) => {
          this.internalSaving.set(false);
          this.snackbar.open('Cursul a fost salvat cu succes', undefined, { duration: 4000 });
          void this.router.navigate(['/coach/courses']);
        },
        error: () => {
          this.internalSaving.set(false);
          this.snackbar.open('Nu am putut salva cursul', undefined, { duration: 4000 });
        }
      });
  }

  handleCancel(): void {
    if (this.isSaving()) {
      return;
    }

    if (this.externalSave) {
      this.cancel.emit();
      return;
    }

    void this.router.navigate(['/coach/courses']);
  }

  toggleDay(index: number, enabled?: boolean): void {
    const control = this.schedule.at(index);
    const currentValue = control.value as DayFormValue;
    const nextEnabled = enabled ?? !currentValue.enabled;
    
    // When enabling a day, set default times if not already set
    const updates: Partial<DayFormValue> = { enabled: nextEnabled };
    if (nextEnabled && (!currentValue.startTime || !currentValue.endTime)) {
      updates.startTime = '18:00';
      updates.endTime = '19:00';
    }
    
    control.patchValue(updates, { emitEvent: false });
    control.markAsTouched();
    this.refreshSelectedDays();
    this.updateSchedulePreview();
    this.scheduleError.set(null);
  }

  onLocationPicked(location: LocationDto): void {
    this.selectedLocationSnapshot = { id: location.id, name: location.name };
  }

  getSelectedLocationName(): string {
    const rawId = (this.form.value.locationId ?? '').toString();
    if (!rawId) {
      return '';
    }
    if (this.selectedLocationSnapshot && this.selectedLocationSnapshot.id === rawId) {
      return this.selectedLocationSnapshot.name;
    }
    return `ID ${rawId}`;
  }

  private setCourseId(id: string): void {
    if (!id) {
      return;
    }
    if (this.currentLoadedId === id) {
      return;
    }
    this.courseIdSignal.set(id);
    if (this.externalData) {
      this.currentLoadedId = id;
      return;
    }
    this.loadCourse(id);
  }

  private initializeScheduleControls(): void {
    if (this.schedule.length) {
      return;
    }
    this.weekDays.forEach((day) => {
      this.schedule.push(
        this.fb.group({
          day: [day.value],
          enabled: [false],
          startTime: ['18:00'],
          endTime: ['19:00']
        })
      );
    });
    this.refreshSelectedDays();
    this.updateSchedulePreview();
  }

  private observeScheduleChanges(): void {
    this.schedule.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.scheduleError.set(null);
      this.refreshSelectedDays();
      this.updateSchedulePreview();
    });
  }

  private refreshSelectedDays(): void {
    const activeDays = this.schedule.controls
      .map((control, index) => ((control.value as DayFormValue).enabled ? this.weekDays[index].label : null))
      .filter((label): label is string => Boolean(label));
    this.selectedDayLabels.set(activeDays);
  }

  private updateSchedulePreview(): void {
    const activeDaysWithTimes = this.schedule.controls
      .map((control, index) => {
        const value = control.value as DayFormValue;
        if (!value.enabled) return null;
        const start = this.normalizeTimeInput(value.startTime);
        const end = this.normalizeTimeInput(value.endTime);
        return `${this.weekDays[index].label} ${start}-${end}`;
      })
      .filter((text): text is string => Boolean(text));

    if (!activeDaysWithTimes.length) {
      this.schedulePreview.set('Selecteaza zilele si seteaza orele.');
      return;
    }

    this.schedulePreview.set(activeDaysWithTimes.join(', '));
  }

  private resetFormForCreate(): void {
    this.form.reset(
      {
        name: '',
        sport: '',
        level: '',
        ageFrom: 8,
        ageTo: 12,
        locationId: '',
        capacity: 10,
        pricePerSession: 0,
        packageOptions: '',
        description: ''
      },
      { emitEvent: false }
    );
    this.selectedLocationSnapshot = null;
    this.schedule.controls.forEach((control, index) => {
      control.reset(
        {
          day: this.weekDays[index].value,
          enabled: false,
          startTime: '18:00',
          endTime: '19:00'
        },
        { emitEvent: false }
      );
    });
    this.refreshSelectedDays();
    this.updateSchedulePreview();
    this.scheduleError.set(null);
    this.form.markAsPristine();
  }

  private loadSports(): void {
    this.sportsLoading.set(true);
    this.sportsLoadFailed.set(false);

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
          this.sportsLoadFailed.set(true);
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

  private loadClubs(): void {
    this.clubsLoading.set(true);
    this.coachApiService
      .getMyClubs()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clubs) => {
          this.clubs.set(clubs ?? []);
          this.clubsLoading.set(false);
        },
        error: () => {
          this.clubsLoading.set(false);
          this.clubs.set([]);
        }
      });
  }

  private loadCoachStripeStatus(): void {
    this.authService.getStripeAccountStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.coachHasStripe.set(status.paymentDestination === 'COACH');
        },
        error: () => {
          this.coachHasStripe.set(false);
        }
      });
  }

  private loadCourse(id: string): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.coachService
      .getCourseDetails(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (course) => {
          this.currentLoadedId = id;
          this.patchCourse(course);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.isLoading.set(false);
        }
      });
  }

  private applyCoursePayload(payload: CourseFormPayload): void {
    this.applyCourseData({
      name: payload.name,
      sport: payload.sport,
      level: payload.level,
      ageFrom: payload.ageFrom,
      ageTo: payload.ageTo,
      locationId: payload.locationId ?? '',
      locationName: payload.locationName ?? null,
      capacity: payload.capacity,
      price: payload.price,
      pricePerSession: payload.pricePerSession,
      packageOptions: payload.packageOptions ?? null,
      description: payload.description ?? null,
      scheduleSlots: payload.schedule ?? []
    });
  }

  private applyCourseData(data: {
    name: string;
    sport?: string | null;
    level?: string | null;
    ageFrom?: number | null;
    ageTo?: number | null;
    locationId?: string | null;
    locationName?: string | null;
    capacity?: number | null;
    price?: number | null;
    pricePerSession?: number | null;
    packageOptions?: string | null;
    description?: string | null;
    scheduleSlots?: CourseScheduleSlot[];
  }): void {
    const slots = Array.isArray(data.scheduleSlots) ? data.scheduleSlots : [];

    this.form.patchValue(
      {
        name: data.name ?? '',
        sport: data.sport ?? '',
        level: data.level ?? '',
        ageFrom: data.ageFrom ?? 8,
        ageTo: data.ageTo ?? 12,
        locationId: data.locationId ?? '',
        capacity: data.capacity ?? 10,
        pricePerSession: (data.pricePerSession ?? 0) / 100, // Convert bani from BE to RON for display
        packageOptions: data.packageOptions ?? '',
        description: data.description ?? ''
      },
      { emitEvent: false }
    );

    // Normalize incoming slot days (API may return uppercase like 'MONDAY')
    const normalizedSlots = slots.map((slot) => ({
      day: (slot.day || '').toString().toLowerCase(),
      dayLabel: slot.dayLabel,
      startTime: this.normalizeTimeInput(slot.startTime),
      endTime: this.normalizeTimeInput(slot.endTime)
    }));

    // Create a map of day -> time slot for easy lookup using lowercase keys
    const slotsByDay = new Map(normalizedSlots.map((slot) => [slot.day, slot]));

    this.schedule.controls.forEach((control, index) => {
      const day = this.weekDays[index].value;
      const slot = slotsByDay.get(day);
      
      if (slot) {
        // Day is enabled with specific times
        control.patchValue(
          {
            day,
            enabled: true,
            startTime: this.normalizeTimeInput(slot.startTime) || '18:00',
            endTime: this.normalizeTimeInput(slot.endTime) || '19:00'
          },
          { emitEvent: false }
        );
      } else {
        // Day is not enabled
        control.patchValue(
          {
            day,
            enabled: false,
            startTime: '18:00',
            endTime: '19:00'
          },
          { emitEvent: false }
        );
      }
    });

    this.ensureLocationOptionFromData(data.locationId, data.locationName);
    this.refreshSelectedDays();
    this.updateSchedulePreview();
    this.form.markAsPristine();
    this.scheduleError.set(null);
  }

  private patchCourse(course: CoachCourseDetail): void {
    this.applyCourseData({
      name: course.name,
      sport: course.sport,
      level: course.level,
      ageFrom: course.ageFrom,
      ageTo: course.ageTo,
      locationId: course.locationId ?? '',
      locationName: course.location ?? null,
      capacity: course.capacity,
      price: course.price,
      description: course.description ?? null,
      scheduleSlots: course.scheduleSlots ?? []
    });
  }

  private ensureLocationOptionFromData(locationId?: string | null, locationName?: string | null): void {
    if (!locationId) {
      this.selectedLocationSnapshot = null;
      return;
    }

    const name = (locationName ?? '').toString().trim();
    this.selectedLocationSnapshot = {
      id: locationId,
      name: name || `Locatie ${locationId}`
    };
  }

  private extractSelectedSlots(): CourseScheduleSlot[] {
    return this.schedule.controls
      .map((control) => control.value as DayFormValue)
      .filter((value) => value.enabled)
      .map((value) => ({
        day: value.day,
        dayLabel: this.dayLabelMap[value.day] ?? value.day,
        startTime: this.normalizeTimeInput(value.startTime),
        endTime: this.normalizeTimeInput(value.endTime)
      }))
      .filter((slot) => slot.startTime && slot.endTime);
  }

  private validateSchedule(slots: CourseScheduleSlot[]): string | null {
    if (!slots.length) {
      return 'Selecteaza cel putin o zi pentru curs si seteaza orele.';
    }

    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) {
        return `Seteaza orele pentru ${slot.dayLabel}.`;
      }
      if (!this.isEndAfterStart(slot.startTime, slot.endTime)) {
        return `Ora de final trebuie sa fie mai tarzie decat ora de start pentru ${slot.dayLabel}.`;
      }
    }

    return null;
  }

  private isEndAfterStart(start: string, end: string): boolean {
    return this.timeToMinutes(end) > this.timeToMinutes(start);
  }

  private timeToMinutes(value: string): number {
    const [hours = '0', minutes = '0'] = value.split(':');
    return Number(hours) * 60 + Number(minutes);
  }

  private normalizeTimeInput(value?: string): string {
    if (!value) {
      return '';
    }
    const parts = value.split(':');
    const hours = parts[0]?.padStart(2, '0') ?? '00';
    const minutes = (parts[1] ?? '00').padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private addMinutesToTime(value: string, minutes: number): string {
    if (!value) {
      return '';
    }
    const total = this.timeToMinutes(value) + minutes;
    const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const hours = Math.floor(normalized / 60)
      .toString()
      .padStart(2, '0');
    const mins = (normalized % 60).toString().padStart(2, '0');
    return `${hours}:${mins}`;
  }

  private validateAgeRange(): ValidatorFn {
    return (group) => {
      const from = group.get('ageFrom')?.value;
      const to = group.get('ageTo')?.value;
      if (from == null || to == null) {
        return null;
      }
      return Number(from) <= Number(to) ? null : { ageRange: true };
    };
  }
}
