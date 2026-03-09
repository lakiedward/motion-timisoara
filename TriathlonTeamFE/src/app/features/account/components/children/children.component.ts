import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { ChildrenService, Child } from '../../services/children.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { DeleteChildDialogComponent, DeleteChildDialogData } from './delete-child-dialog.component';

@Component({
  selector: 'app-children',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatDividerModule, MatTooltipModule, DatePipe],
  templateUrl: './children.component.html',
  styleUrls: ['./children.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChildrenComponent implements OnInit {
  private readonly childrenService = inject(ChildrenService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly children = signal<Child[]>([]);
  scrollProgress = 0;

  @HostListener('window:scroll')
  onScroll(): void {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.scrollProgress = height > 0 ? (winScroll / height) * 100 : 0;
  }

  ngOnInit(): void {
    this.childrenService.children$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((children) => this.children.set(children));

    this.childrenService.loadChildren().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  openAdd(): void {
    void this.router.navigate(['/account/child', 'new']);
  }

  openEdit(child: Child): void {
    void this.router.navigate(['/account/child', child.id]);
  }

  deleteChild(child: Child): void {
    // Load enrollments to check if child has active ones
    this.enrollmentService.getEnrollments()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(enrollments => {
          // Filter enrollments by child ID (unique identifier)
          const childEnrollments = enrollments.filter(e => e.childId === child.id);
          const activeEnrollments = childEnrollments.filter(
            e => e.status === 'pending' || e.status === 'active'
          );
          
          const dialogData: DeleteChildDialogData = {
            childName: child.name,
            activeEnrollmentsCount: activeEnrollments.length
          };
          
          const dialogRef = this.dialog.open(DeleteChildDialogComponent, {
            data: dialogData,
            width: '600px',
            maxWidth: '95vw',
            panelClass: 'premium-dialog'
          });
          
          return dialogRef.afterClosed();
        }),
        switchMap(confirmed => {
          if (confirmed) {
            return this.childrenService.deleteChild(child.id);
          }
          return of(null);
        })
      )
      .subscribe();
  }

  calculateAge(birthDate: string | Date): number {
    const birth = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const hasNotHadBirthdayThisYear =
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());

    if (hasNotHadBirthdayThisYear) {
      age -= 1;
    }

    return Math.max(age, 0);
  }
}
