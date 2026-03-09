import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClubService, ClubCoach, ClubInvitationCode } from '../../services/club.service';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

type CodeFilter = 'recent' | 'active' | 'used' | 'all';

@Component({
  selector: 'app-club-coaches',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    DatePipe
  ],
  templateUrl: './club-coaches.component.html',
  styleUrls: ['./club-coaches.component.scss']
})
export class ClubCoachesComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  // State
  readonly coaches = signal<ClubCoach[]>([]);
  readonly invitationCodes = signal<ClubInvitationCode[]>([]);
  readonly isLoading = signal(true);
  readonly codeFilter = signal<CodeFilter>('recent');
  readonly failedCoachPhotoUserIds = signal<Set<string>>(new Set());

  // Computed
  readonly filteredInvitationCodes = computed(() => {
    const codes = this.invitationCodes();
    const filter = this.codeFilter();
    
    switch (filter) {
      case 'active':
        return codes.filter(c => c.isValid);
      case 'used':
        return codes.filter(c => !c.isValid);
      case 'recent':
        return [...codes].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 6);
      default:
        return codes;
    }
  });

  readonly activeCodesCount = computed(() => 
    this.invitationCodes().filter(c => c.isValid).length
  );

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    forkJoin({
      coaches: this.clubService.getCoaches(),
      codes: this.clubService.getInvitationCodes()
    }).subscribe({
      next: ({ coaches, codes }) => {
        this.coaches.set(coaches);
        this.invitationCodes.set(codes);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('Eroare la încărcarea datelor', 'OK', { duration: 3000 });
        this.isLoading.set(false);
      }
    });
  }

  setCodeFilter(filter: CodeFilter): void {
    this.codeFilter.set(filter);
  }

  generateInvitationCode(): void {
    this.clubService.createInvitationCode({ maxUses: 1, expiresInDays: 30 }).subscribe({
      next: (code) => {
        this.invitationCodes.update(codes => [code, ...codes]);
        this.snackBar.open('Cod de invitație generat cu succes!', 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Eroare la generarea codului', 'OK', { duration: 3000 });
      }
    });
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.snackBar.open('Cod copiat în clipboard!', 'OK', { duration: 2000 });
    });
  }

  deleteInvitationCode(code: ClubInvitationCode): void {
    if (!confirm('Sigur doriți să ștergeți acest cod?')) return;
    
    this.clubService.deleteInvitationCode(code.id).subscribe({
      next: () => {
        this.invitationCodes.update(codes => codes.filter(c => c.id !== code.id));
        this.snackBar.open('Cod șters cu succes!', 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Eroare la ștergerea codului', 'OK', { duration: 3000 });
      }
    });
  }

  removeCoach(coach: ClubCoach): void {
    if (!confirm(`Sigur doriți să eliminați antrenorul ${coach.name} din club?`)) return;
    
    this.clubService.removeCoach(coach.id).subscribe({
      next: () => {
        this.coaches.update(c => c.filter(x => x.id !== coach.id));
        this.snackBar.open('Antrenor eliminat din club', 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Eroare la eliminarea antrenorului', 'OK', { duration: 3000 });
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getCoachPhotoUrl(coachUserId: string): string {
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachUserId}/photo`;
  }

  canShowCoachPhoto(coach: ClubCoach): boolean {
    if (!coach?.hasPhoto) return false;
    return !this.failedCoachPhotoUserIds().has(coach.userId);
  }

  onCoachPhotoError(coachUserId: string): void {
    this.failedCoachPhotoUserIds.update((set) => {
      const next = new Set(set);
      next.add(coachUserId);
      return next;
    });
  }

  isExpired(code: ClubInvitationCode): boolean {
    if (!code.expiresAt) return false;
    return new Date(code.expiresAt) < new Date();
  }

  openCreateCoachPage(): void {
    void this.router.navigate(['/club/coaches/new']);
  }

  editCoach(coach: ClubCoach): void {
    void this.router.navigate(['/club/coaches', coach.id, 'edit']);
  }
}
