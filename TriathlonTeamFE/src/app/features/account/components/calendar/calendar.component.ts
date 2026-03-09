import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnInit, computed, signal, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CalendarEvent } from '../../services/account.service';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  // Accept events as input and sync to signal for reactivity
  @Input() set events(value: CalendarEvent[]) {
    this.eventsSignal.set(value);
  }

  readonly eventsSignal = signal<CalendarEvent[]>([]);

  readonly currentDate = signal(new Date());
  readonly selectedDate = signal<Date | null>(null);

  readonly monthNames = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie'
  ];

  readonly dayNames = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const current = this.currentDate();
    const year = current.getFullYear();
    const month = current.getMonth();
    
    // Access eventsSignal to create reactive dependency
    const events = this.eventsSignal();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from Monday
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: this.isSameDay(date, today),
        events: this.getEventsForDate(date, events)
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: this.isSameDay(date, today),
        events: this.getEventsForDate(date, events)
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: this.isSameDay(date, today),
        events: this.getEventsForDate(date, events)
      });
    }

    return days;
  });

  readonly currentMonthYear = computed(() => {
    const date = this.currentDate();
    return `${this.monthNames[date.getMonth()]} ${date.getFullYear()}`;
  });

  readonly selectedDayEvents = computed(() => {
    const selected = this.selectedDate();
    if (!selected) return [];
    const events = this.eventsSignal();
    return this.getEventsForDate(selected, events);
  });

  ngOnInit(): void {
    // Select today by default if there are events
    const today = new Date();
    const todayEvents = this.getEventsForDate(today, this.eventsSignal());
    if (todayEvents.length > 0) {
      this.selectedDate.set(today);
    }
  }

  previousMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  selectDay(day: CalendarDay): void {
    if (day.events.length > 0) {
      this.selectedDate.set(day.date);
    }
  }

  getEventTypeClass(type: string): string {
    return `event-marker--${type}`;
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private getEventsForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
    return events.filter((event) => this.isSameDay(event.date, date));
  }

  trackByEvent(_: number, event: CalendarEvent): string {
    return event.id;
  }
}

