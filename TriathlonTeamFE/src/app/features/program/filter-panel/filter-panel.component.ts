import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, DestroyRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocationSummary, ScheduleFilters, PublicApiService } from '../../../core/services/public-api.service';

interface ChipOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './filter-panel.component.html',
  styleUrls: ['./filter-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(PublicApiService);

  @Input() locations: LocationSummary[] | null = [];
  @Output() filtersChange = new EventEmitter<ScheduleFilters>();

  readonly sports = signal<ChipOption<ScheduleFilters['sport']>[]>([]);

  readonly days: ChipOption<number>[] = [
    { label: 'L', value: 1 },
    { label: 'Ma', value: 2 },
    { label: 'Mi', value: 3 },
    { label: 'J', value: 4 },
    { label: 'V', value: 5 },
    { label: 'S', value: 6 },
    { label: 'D', value: 7 }
  ];

  readonly levels = signal<ChipOption<Exclude<ScheduleFilters['level'], undefined | ''>>[]>([]);

  readonly filterForm = this.fb.nonNullable.group({
    sport: this.fb.control<ScheduleFilters['sport'] | ''>(''),
    daysOfWeek: this.fb.control<number[]>([]),
    level: this.fb.control<ScheduleFilters['level'] | ''>(''),
    childAge: this.fb.control<number | null>(null),
    locationId: this.fb.control<string | ''>('')
  });

  constructor() {
    this.loadSports();
    this.loadLevels();
    
    this.filterForm.valueChanges
      .pipe(
        debounceTime(200),
        map((value) => this.normalizeFilters(value)),
        distinctUntilChanged((prev, next) => JSON.stringify(prev) === JSON.stringify(next)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((filters) => this.filtersChange.emit(filters));
  }

  private loadSports(): void {
    this.api.getPublicSports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => {
          const sportOptions = sports.map(sport => ({
            label: sport.name,
            value: sport.code as ScheduleFilters['sport']
          }));
          this.sports.set(sportOptions);
        },
        error: () => {
          // Fallback la sporturi hardcodate dacă API-ul nu este disponibil
          const fallbackSports = [
            { label: 'Inot', value: 'inot' as ScheduleFilters['sport'] },
            { label: 'Ciclism', value: 'ciclism' as ScheduleFilters['sport'] },
            { label: 'Alergare', value: 'alergare' as ScheduleFilters['sport'] },
            { label: 'Triatlon', value: 'triatlon' as ScheduleFilters['sport'] },
            { label: 'Fitness', value: 'fitness' as ScheduleFilters['sport'] }
          ];
          this.sports.set(fallbackSports);
        }
      });
  }

  private loadLevels(): void {
    // Nivelurile rămân hardcodate pentru moment
    const levelOptions = [
      { label: 'Incepatori', value: 'incepator' },
      { label: 'Intermediari', value: 'intermediar' },
      { label: 'Avansati', value: 'avansat' }
    ];
    this.levels.set(levelOptions);
  }

  selectSport(option: ChipOption<ScheduleFilters['sport']>): void {
    const current = this.filterForm.controls.sport.value;
    this.filterForm.patchValue({ sport: current === option.value ? '' : option.value });
  }

  selectDay(option: ChipOption<number>): void {
    const current = this.filterForm.controls.daysOfWeek.value ?? [];
    const index = current.indexOf(option.value);
    
    if (index > -1) {
      // Dacă ziua este deja selectată, o eliminăm
      const newDays = current.filter(d => d !== option.value);
      this.filterForm.patchValue({ daysOfWeek: newDays });
    } else {
      // Dacă ziua nu este selectată, o adăugăm
      this.filterForm.patchValue({ daysOfWeek: [...current, option.value] });
    }
  }
  
  isDaySelected(dayValue: number): boolean {
    const days = this.filterForm.controls.daysOfWeek.value;
    return days ? days.includes(dayValue) : false;
  }

  selectLevel(option: ChipOption<Exclude<ScheduleFilters['level'], undefined | ''>>): void {
    const current = this.filterForm.controls.level.value;
    this.filterForm.patchValue({ level: current === option.value ? '' : option.value });
  }

  readonly ageGroups: ChipOption<number>[] = [
    { label: '3-5 ani', value: 4 },
    { label: '6-8 ani', value: 7 },
    { label: '9-11 ani', value: 10 },
    { label: '12-14 ani', value: 13 },
    { label: '15+ ani', value: 16 }
  ];

  selectAgeGroup(option: ChipOption<number>): void {
    const current = this.filterForm.controls.childAge.value;
    this.filterForm.patchValue({ childAge: current === option.value ? null : option.value });
  }

  resetFilters(): void {
    this.filterForm.reset({
      sport: '',
      daysOfWeek: [],
      level: '',
      childAge: null,
      locationId: ''
    });
  }

  hasActiveFilters(): boolean {
    const { sport, daysOfWeek, level, childAge, locationId } = this.filterForm.value;
    return !!(sport || (daysOfWeek && daysOfWeek.length > 0) || level || childAge || locationId);
  }

  activeFiltersCount(): number {
    let count = 0;
    const { sport, daysOfWeek, level, childAge, locationId } = this.filterForm.value;
    if (sport) count++;
    if (daysOfWeek && daysOfWeek.length > 0) count++;
    if (level) count++;
    if (childAge) count++;
    if (locationId) count++;
    return count;
  }

  clearSport(): void {
    this.filterForm.patchValue({ sport: '' });
  }

  clearDays(): void {
    this.filterForm.patchValue({ daysOfWeek: [] });
  }

  clearLevel(): void {
    this.filterForm.patchValue({ level: '' });
  }

  clearAge(): void {
    this.filterForm.patchValue({ childAge: null });
  }

  private normalizeFilters(value: typeof this.filterForm.value): ScheduleFilters & { daysOfWeek?: number[] } {
    const filters: any = {};
    if (value.sport) {
      filters.sport = value.sport;
    }
    if (value.daysOfWeek && value.daysOfWeek.length > 0) {
      // Trimitem array-ul de zile pentru procesare custom în componentă
      filters.daysOfWeek = value.daysOfWeek;
    }
    if (value.level) {
      filters.level = value.level;
    }
    // Trimitem vârsta exactă: backend-ul cere ca intervalul cursului să includă [ageFrom, ageTo]
    if (value.childAge != null) {
      filters.ageFrom = value.childAge;
      filters.ageTo = value.childAge;
    }
    if (value.locationId) {
      filters.locationId = value.locationId;
    }
    return filters;
  }
}
