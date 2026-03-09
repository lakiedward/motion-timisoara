import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Clipboard } from '@angular/cdk/clipboard';
import { forkJoin } from 'rxjs';
import { AdminService, InvitationCode } from '../../services/admin.service';
import { AdminCoachListItem } from '../../services/models/admin-coach.model';

type CodeFilterType = 'recent' | 'active' | 'used' | 'all';

@Component({
  selector: 'app-admin-coach-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './admin-coach-list.component.html',
  styleUrls: ['./admin-coach-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCoachListComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly clipboard = inject(Clipboard);

  readonly coaches = signal<AdminCoachListItem[]>([]);
  readonly invitationCodes = signal<InvitationCode[]>([]);
  readonly isLoading = signal(true);
  readonly codeFilter = signal<CodeFilterType>('recent');

  // Coach filters
  readonly coachSearch = signal('');
  readonly coachCity = signal('');

  readonly coachCities = computed(() => {
    const unique = new Map<string, string>(); // normalized -> display value

    for (const coach of this.coaches()) {
      for (const rawCity of coach.cities ?? []) {
        const display = rawCity?.trim();
        if (!display) continue;

        const key = this.normalizeText(display);
        if (!key) continue;

        if (!unique.has(key)) {
          unique.set(key, display);
        }
      }
    }

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, 'ro'));
  });

  readonly hasCoachFilters = computed(() => {
    return Boolean(this.coachSearch().trim() || this.coachCity().trim());
  });

  readonly filteredCoaches = computed(() => {
    const list = this.coaches();
    const cityKey = this.normalizeText(this.coachCity());
    const query = this.normalizeText(this.coachSearch());

    return list.filter((coach) => {
      const matchesCity =
        !cityKey || (coach.cities ?? []).some((c) => this.normalizeText(c) === cityKey);

      if (!matchesCity) return false;
      if (!query) return true;

      const searchable = [
        coach.name,
        coach.email,
        coach.phone ?? '',
        ...(coach.cities ?? [])
      ]
        .map((v) => this.normalizeText(v))
        .join(' ');

      return searchable.includes(query);
    });
  });

  readonly filteredInvitationCodes = computed(() => {
    const codes = this.invitationCodes();
    const filter = this.codeFilter();

    // Sort by creation date (newest first)
    const sorted = [...codes].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    switch (filter) {
      case 'recent':
        return sorted.slice(0, 3);
      case 'active':
        return sorted.filter(c => c.valid && !c.expired);
      case 'used':
        return sorted.filter(c => !c.valid || c.expired);
      case 'all':
      default:
        return sorted;
    }
  });

  ngOnInit(): void {
    this.loadData();
  }

  setCodeFilter(filter: CodeFilterType): void {
    this.codeFilter.set(filter);
  }

  setCoachSearch(value: string): void {
    this.coachSearch.set(value);
  }

  setCoachCity(value: string): void {
    this.coachCity.set(value);
  }

  resetCoachFilters(): void {
    this.coachSearch.set('');
    this.coachCity.set('');
  }

  generateInvitationCode(): void {
    this.adminService
      .createInvitationCode(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (code) => {
          this.clipboard.copy(code.code);
          this.snackbar.open(`Cod generat și copiat: ${code.code}`, 'OK', { duration: 6000 });
          this.loadInvitationCodes();
        },
        error: () => {
          this.snackbar.open('Nu am putut genera codul', undefined, { duration: 4000 });
        }
      });
  }

  createCoach(): void {
    void this.router.navigate(['/admin/coaches/new']);
  }

  copyCode(code: string): void {
    this.clipboard.copy(code);
    this.snackbar.open('Cod copiat în clipboard!', undefined, { duration: 2000 });
  }

  deleteInvitationCode(code: InvitationCode): void {
    // If code has been used, revoke instead of delete
    if (code.currentUses > 0) {
      const confirmed = confirm(`Codul ${code.code} a fost folosit. Vrei să-l revoci (dezactivezi)?`);
      if (!confirmed) return;

      this.adminService
        .revokeInvitationCode(code.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackbar.open('Cod revocat cu succes', undefined, { duration: 2000 });
            this.loadInvitationCodes();
          },
          error: () => {
            this.snackbar.open('Nu am putut revoca codul', undefined, { duration: 4000 });
          }
        });
    } else {
      const confirmed = confirm(`Ștergi codul ${code.code}?`);
      if (!confirmed) return;

      this.adminService
        .deleteInvitationCode(code.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackbar.open('Cod șters', undefined, { duration: 2000 });
            this.loadInvitationCodes();
          },
          error: () => {
            this.snackbar.open('Nu am putut șterge codul', undefined, { duration: 4000 });
          }
        });
    }
  }

  editCoach(coach: AdminCoachListItem): void {
    void this.router.navigate(['/admin/coaches', coach.id, 'edit']);
  }

  deleteCoach(coach: AdminCoachListItem): void {
    const needsForce = coach.courseCount > 0;
    const confirmed = confirm(
      needsForce
        ? `Antrenorul "${coach.name}" are ${coach.courseCount} cursuri. Vrei să ștergi oricum (force delete)? Această acțiune nu poate fi anulată.`
        : `Ești sigur că vrei să ștergi definitiv antrenorul "${coach.name}"? Această acțiune nu poate fi anulată.`
    );

    if (!confirmed) return;

    this.performDelete(coach, needsForce);
  }

  private performDelete(coach: AdminCoachListItem, force: boolean): void {
    this.adminService
      .deleteCoach(coach.id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Antrenorul a fost șters cu succes', undefined, { duration: 4000 });
          this.loadCoaches();
        },
        error: (err) => {
          if (err.status === 409 && !force) {
            const confirmedForce = confirm(
              err.error?.message ||
                `Nu pot șterge antrenorul "${coach.name}" fără force. Vrei să ștergi oricum (force delete)?`
            );
            if (confirmedForce) {
              this.performDelete(coach, true);
            }
            return;
          }

          const message = err.error?.message || 'Nu am putut șterge antrenorul';
          this.snackbar.open(message, undefined, { duration: 5000 });
        }
      });
  }

  private loadData(): void {
    this.isLoading.set(true);
    forkJoin({
      coaches: this.adminService.getAllCoaches(),
      codes: this.adminService.getInvitationCodes()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ coaches, codes }) => {
          this.coaches.set(coaches);
          this.invitationCodes.set(codes);
          this.isLoading.set(false);
        },
        error: () => {
          this.coaches.set([]);
          this.invitationCodes.set([]);
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut încărca datele', undefined, { duration: 4000 });
        }
      });
  }

  private loadCoaches(): void {
    this.adminService
      .getAllCoaches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coaches) => this.coaches.set(coaches),
        error: () => this.snackbar.open('Nu am putut reîncărca lista', undefined, { duration: 4000 })
      });
  }

  private loadInvitationCodes(): void {
    this.adminService
      .getInvitationCodes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (codes) => this.invitationCodes.set(codes),
        error: () => {}
      });
  }

  getCoachPhotoUrl(coachId: string): string {
    return this.adminService.getCoachPhotoUrl(coachId);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getActiveCodesCount(): number {
    return this.invitationCodes().filter(c => c.valid && !c.expired).length;
  }

  getTotalCourses(): number {
    return this.coaches().reduce((sum, coach) => sum + coach.courseCount, 0);
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}

