import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  computed,
  signal
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  PremiumConfirmDialogComponent,
  PremiumConfirmDialogData
} from '../../../../shared/components/premium-confirm-dialog/premium-confirm-dialog.component';
import { SportService } from '../../services/sport.service';
import { Sport } from '../../services/models/sport.model';
import { SportDialogComponent } from './sport-dialog.component';

@Component({
  selector: 'app-admin-sports-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './admin-sports-list.component.html',
  styleUrls: ['./admin-sports-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSportsListComponent implements OnInit {
  private readonly sportService = inject(SportService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly sports = signal<Sport[]>([]);
  readonly isLoading = signal(true);

  readonly sortedSports = computed(() => {
    const sports = this.sports();
    return [...sports].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ro', { sensitivity: 'base' })
    );
  });

  readonly duplicateCodesCount = computed(() =>
    this.countDuplicateKeys(this.sports().map((s) => this.normalizeValue(s.code)))
  );

  readonly duplicateNamesCount = computed(() =>
    this.countDuplicateKeys(this.sports().map((s) => this.normalizeValue(s.name)))
  );

  ngOnInit(): void {
    this.loadSports();
  }

  loadSports(): void {
    this.isLoading.set(true);
    this.sportService
      .getSports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sports) => {
          this.sports.set(sports);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.snackbar.open('Eroare la încărcarea sporturilor', undefined, { duration: 3000 });
        }
      });
  }

  addSport(): void {
    const dialogRef = this.dialog.open(SportDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'modern-dialog',
      data: null,
      disableClose: false
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((added) => {
        if (added) {
          this.snackbar.open('Sportul a fost adăugat cu succes', undefined, { duration: 3000 });
          this.loadSports();
        }
      });
  }

  editSport(sport: Sport): void {
    const dialogRef = this.dialog.open(SportDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'modern-dialog',
      data: sport,
      disableClose: false
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        if (updated) {
          this.snackbar.open('Sportul a fost actualizat cu succes', undefined, { duration: 3000 });
          this.loadSports();
        }
      });
  }

  deleteSport(sport: Sport): void {
    const dialogRef = this.dialog.open<
      PremiumConfirmDialogComponent,
      PremiumConfirmDialogData,
      boolean
    >(PremiumConfirmDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'modern-dialog',
      data: {
        title: `Ștergi sportul „${sport.name}”?`,
        subtitle: sport.code ? `Cod: ${sport.code}` : undefined,
        description:
          'Sportul va fi șters definitiv din platformă. Dacă este asociat cu antrenori sau cursuri, ștergerea va eșua.',
        note: 'Recomandare: dacă sportul este deja folosit, editează numele în loc să îl ștergi.',
        confirmText: 'Șterge',
        cancelText: 'Anulează',
        icon: 'delete_forever',
        variant: 'danger'
      }
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.sportService
          .deleteSport(sport.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.open('Sportul a fost șters cu succes', undefined, { duration: 3000 });
              this.loadSports();
            },
            error: () => {
              this.snackbar.open(
                'Nu se poate șterge un sport asociat cu antrenori sau cursuri',
                undefined,
                { duration: 4000 }
              );
            }
          });
      });
  }

  private normalizeValue(value: string | null | undefined): string {
    return (value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private countDuplicateKeys(values: string[]): number {
    const counts = new Map<string, number>();
    for (const value of values) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    let duplicates = 0;
    counts.forEach((count) => {
      if (count > 1) duplicates += 1;
    });

    return duplicates;
  }

  trackBySport(_: number, sport: Sport): string {
    return sport.id;
  }
}

