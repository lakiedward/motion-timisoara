import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, DestroyRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachFilters, LocationSummary, PublicApiService, PublicSport } from '../../../../core/services/public-api.service';

interface ChipOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-coach-filter-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './coach-filter-panel.component.html',
  styleUrls: ['./coach-filter-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachFilterPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(PublicApiService);

  @Input() locations: LocationSummary[] | null = [];
  @Output() filtersChange = new EventEmitter<CoachFilters>();

  readonly sports = signal<PublicSport[]>([]);

  readonly filterForm = this.fb.nonNullable.group({
    sportId: this.fb.control<string | ''>(''),
    locationId: this.fb.control<string | ''>('')
  });

  constructor() {
    this.loadSports();
    
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
          this.sports.set(sports);
        },
        error: () => {
          this.sports.set([]);
        }
      });
  }

  selectSport(sport: PublicSport | null): void {
    if (sport === null) {
      this.filterForm.patchValue({ sportId: '' });
    } else {
      const current = this.filterForm.controls.sportId.value;
      this.filterForm.patchValue({ sportId: current === sport.id ? '' : sport.id });
    }
  }

  resetFilters(): void {
    this.filterForm.reset({
      sportId: '',
      locationId: ''
    });
  }

  hasActiveFilters(): boolean {
    const { sportId, locationId } = this.filterForm.value;
    return !!(sportId || locationId);
  }

  activeFiltersCount(): number {
    let count = 0;
    if (this.filterForm.value.sportId) count++;
    if (this.filterForm.value.locationId) count++;
    return count;
  }

  private normalizeFilters(value: typeof this.filterForm.value): CoachFilters {
    const filters: CoachFilters = {};
    if (value.sportId) {
      filters.sportId = value.sportId;
    }
    if (value.locationId) {
      filters.locationId = value.locationId;
    }
    return filters;
  }
}

