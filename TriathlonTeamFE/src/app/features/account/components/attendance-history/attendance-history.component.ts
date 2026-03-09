import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttendanceCourse, AttendanceService, AttendanceSession } from '../../services/attendance.service';
import { Child, ChildrenService } from '../../services/children.service';

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgIf, NgFor, MatIconModule, MatButtonModule, MatDividerModule, DatePipe],
  templateUrl: './attendance-history.component.html',
  styleUrls: ['./attendance-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceHistoryComponent implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly childrenService = inject(ChildrenService);
  private readonly destroyRef = inject(DestroyRef);

  readonly children = signal<Child[]>([]);
  readonly selectedChildId = signal<string | null>(null);
  readonly attendance = signal<AttendanceCourse[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly expandedCourses = signal<Set<string>>(new Set());
  scrollProgress = 0;

  @HostListener('window:scroll')
  onScroll(): void {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.scrollProgress = height > 0 ? (winScroll / height) * 100 : 0;
  }

  readonly selectedChildName = computed(() => {
    const currentId = this.selectedChildId();
    return this.children().find((child) => child.id === currentId)?.name ?? null;
  });

  readonly hasChildren = computed(() => this.children().length > 0);

  readonly totalPresent = computed(() => {
    return this.attendance().reduce((sum, course) => sum + this.countPresent(course), 0);
  });

  readonly totalAbsent = computed(() => {
    return this.attendance().reduce((sum, course) => sum + this.countAbsent(course), 0);
  });

  readonly overallAttendanceRate = computed(() => {
    const total = this.totalPresent() + this.totalAbsent();
    if (total === 0) return 0;
    return Math.round((this.totalPresent() / total) * 100);
  });

  Math = Math; // For template access

  ngOnInit(): void {
    this.childrenService.children$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((children) => {
        const list = children ?? [];
        this.children.set(list);

        if (!list.length) {
          this.attendance.set([]);
          this.isLoading.set(false);
          return;
        }

        if (!this.selectedChildId()) {
          this.selectChild(list[0].id);
        }
      });

    this.childrenService
      .loadChildren()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  onChildChange(childId: string): void {
    this.selectChild(childId);
  }

  sessionClass(status: AttendanceSession['status']): string {
    return status === 'present' ? 'present' : 'absent';
  }

  trackByCourse(_: number, course: AttendanceCourse): string {
    return course.id;
  }

  trackBySession(_: number, session: AttendanceSession): string {
    return session.id;
  }

  countPresent(course: AttendanceCourse): number {
    return course.sessions.filter((session) => session.status === 'present').length;
  }

  countAbsent(course: AttendanceCourse): number {
    return course.sessions.filter((session) => session.status === 'absent').length;
  }

  attendanceRate(course: AttendanceCourse): number {
    const total = course.sessions.length;
    if (total === 0) return 0;
    const present = this.countPresent(course);
    return Math.round((present / total) * 100);
  }

  toggleShowAll(courseId: string): void {
    const expanded = new Set(this.expandedCourses());
    if (expanded.has(courseId)) {
      expanded.delete(courseId);
    } else {
      expanded.add(courseId);
    }
    this.expandedCourses.set(expanded);
  }

  isExpanded(courseId: string): boolean {
    return this.expandedCourses().has(courseId);
  }

  getVisibleSessions(course: AttendanceCourse): AttendanceSession[] {
    if (this.isExpanded(course.id)) {
      return course.sessions;
    }
    return course.sessions.slice(0, 10);
  }

  retry(): void {
    const childId = this.selectedChildId();
    if (childId) {
      this.fetchAttendance(childId);
    }
  }

  private selectChild(childId: string): void {
    if (!childId) {
      return;
    }

    this.selectedChildId.set(childId);
    this.fetchAttendance(childId);
  }

  private fetchAttendance(childId: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.attendanceService
      .getChildAttendance(childId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (courses) => {
          this.attendance.set(courses ?? []);
          this.isLoading.set(false);
          this.hasError.set(false);
        },
        error: () => {
          this.attendance.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });
  }
}