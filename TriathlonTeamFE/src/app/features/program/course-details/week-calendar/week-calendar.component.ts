import { Component, Input, computed, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CourseOccurrence } from '../../../../core/services/public-api.service';

interface CalendarDay {
  dayOfWeek: number; // 0 = Duminică, 1 = Luni, etc.
  dayName: string;
  occurrences: CourseOccurrence[];
  isToday: boolean;
}

@Component({
  selector: 'app-week-calendar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './week-calendar.component.html',
  styleUrls: ['./week-calendar.component.scss']
})
export class WeekCalendarComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) occurrences: CourseOccurrence[] = [];
  @Input() courseId: string = '';
  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('hintElement') hintElement?: ElementRef<HTMLDivElement>;
  
  private readonly platformId = inject(PLATFORM_ID);
  private scrollListener?: () => void;
  private hasScrolledOnce = false;

  // Zilele săptămânii în română (începând cu Luni)
  private readonly weekDayNames: string[] = [
    'Luni',
    'Marți',
    'Miercuri',
    'Joi',
    'Vineri',
    'Sâmbătă',
    'Duminică'
  ];

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Duminică, 1 = Luni, etc.
    
    // Grupează occurrence-urile după ziua săptămânii
    const occurrencesByDay = new Map<number, CourseOccurrence[]>();
    
    this.occurrences.forEach(occurrence => {
      const occurrenceDate = new Date(occurrence.startTime);
      let dayOfWeek = occurrenceDate.getDay(); // 0 = Duminică, 1 = Luni, etc.
      
      // Convertește: Duminică (0) devine 7, restul rămân la fel
      if (dayOfWeek === 0) dayOfWeek = 7;
      
      if (!occurrencesByDay.has(dayOfWeek)) {
        occurrencesByDay.set(dayOfWeek, []);
      }
      occurrencesByDay.get(dayOfWeek)!.push(occurrence);
    });
    
    // Creează calendar pentru Luni (1) - Duminică (7)
    return Array.from({ length: 7 }, (_, index) => {
      const dayOfWeek = index + 1; // 1 = Luni, 2 = Marți, ..., 7 = Duminică
      const allDayOccurrences = occurrencesByDay.get(dayOfWeek) || [];
      
      // Deduplicate occurrences by time (keep only unique time slots)
      const uniqueOccurrences = this.deduplicateByTime(allDayOccurrences);
      
      // Determină dacă astăzi este această zi
      let isTodayThisDay = false;
      if (todayDayOfWeek === 0) {
        // Astăzi este Duminică
        isTodayThisDay = dayOfWeek === 7;
      } else {
        // Alte zile
        isTodayThisDay = todayDayOfWeek === dayOfWeek;
      }

      return {
        dayOfWeek,
        dayName: this.weekDayNames[index],
        occurrences: uniqueOccurrences,
        isToday: isTodayThisDay
      };
    });
  });

  formatTime(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const startStr = this.formatTimeOnly(start);
    const endStr = this.formatTimeOnly(end);
    
    return `${startStr}–${endStr}`;
  }

  private formatTimeOnly(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private deduplicateByTime(occurrences: CourseOccurrence[]): CourseOccurrence[] {
    if (occurrences.length === 0) return [];
    
    // Map to track unique time slots
    const uniqueTimesMap = new Map<string, CourseOccurrence>();
    
    occurrences.forEach(occurrence => {
      const start = new Date(occurrence.startTime);
      const end = new Date(occurrence.endTime);
      
      // Create a key based on the time (hours and minutes only)
      const timeKey = `${this.formatTimeOnly(start)}-${this.formatTimeOnly(end)}`;
      
      // Keep only the first occurrence for each unique time slot
      if (!uniqueTimesMap.has(timeKey)) {
        uniqueTimesMap.set(timeKey, occurrence);
      }
    });
    
    // Return deduplicated occurrences sorted by start time
    return Array.from(uniqueTimesMap.values()).sort((a, b) => {
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();
      return timeA - timeB;
    });
  }

  getDayClass(day: CalendarDay): string {
    const classes = ['calendar-day'];
    
    if (day.isToday) {
      classes.push('today');
    }
    
    if (day.occurrences.length === 0) {
      classes.push('no-class');
    }
    
    return classes.join(' ');
  }

  trackByDay(index: number, day: CalendarDay): number {
    return day.dayOfWeek;
  }

  trackByOccurrence(index: number, occurrence: CourseOccurrence): string {
    return occurrence.id;
  }
  
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.scrollContainer) {
      return;
    }
    
    const container = this.scrollContainer.nativeElement;
    
    // Initial check
    this.updateScrollIndicators(container);
    
    // Add scroll listener
    this.scrollListener = () => this.updateScrollIndicators(container);
    container.addEventListener('scroll', this.scrollListener, { passive: true });
  }
  
  ngOnDestroy(): void {
    if (this.scrollListener && this.scrollContainer) {
      this.scrollContainer.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
  }
  
  private updateScrollIndicators(container: HTMLElement): void {
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    
    // Show left fade if scrolled right
    if (scrollLeft > 10) {
      container.classList.add('has-scroll-left');
      
      // Hide hint after first scroll
      if (!this.hasScrolledOnce && this.hintElement) {
        this.hasScrolledOnce = true;
        this.hintElement.nativeElement.style.opacity = '0';
        setTimeout(() => {
          if (this.hintElement) {
            this.hintElement.nativeElement.style.display = 'none';
          }
        }, 300);
      }
    } else {
      container.classList.remove('has-scroll-left');
    }
    
    // Hide right fade if at end
    if (scrollLeft >= maxScroll - 10) {
      container.classList.add('at-scroll-end');
    } else {
      container.classList.remove('at-scroll-end');
    }
  }
}
