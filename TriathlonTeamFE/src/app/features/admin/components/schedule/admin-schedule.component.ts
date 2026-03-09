import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, DestroyRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, WeeklyOccurrence } from '../../services/admin-api.service';

interface GroupedSchedule {
  day: number;
  items: WeeklyOccurrence[];
}

const DAY_LABELS = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata', 'Duminica'];

@Component({
  selector: 'app-admin-schedule',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './admin-schedule.component.html',
  styleUrls: ['./admin-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminScheduleComponent {
  private readonly api = inject(AdminApiService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly groups = signal<GroupedSchedule[]>([]);

  constructor() {
    this.loadSchedule();
  }

  dayLabel(day: number): string {
    return DAY_LABELS[(day - 1 + 7) % 7];
  }

  private loadSchedule(): void {
    this.isLoading.set(true);
    this.api
      .getWeeklySchedule()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          const grouped: Record<number, WeeklyOccurrence[]> = {};
          items.forEach((item) => {
            if (!grouped[item.dayOfWeek]) {
              grouped[item.dayOfWeek] = [];
            }
            grouped[item.dayOfWeek].push(item);
          });
          const sorted = Object.keys(grouped)
            .map((key) => Number(key))
            .sort((a, b) => a - b)
            .map((day) => ({ day, items: grouped[day] }));
          this.groups.set(sorted);
          this.isLoading.set(false);
        },
        error: () => {
          this.groups.set([]);
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut incarca programul', undefined, { duration: 4000 });
        },
      });
  }
}
