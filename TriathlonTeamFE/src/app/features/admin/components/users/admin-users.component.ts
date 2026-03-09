import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService, AdminUser, UpdateUserPayload } from '../../services/admin.service';
import { DeleteUserDialogComponent, DeleteUserDialogData, DeleteUserDialogResult } from './delete-user-dialog.component';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject<string>(API_BASE_URL);

  readonly users = signal<AdminUser[]>([]);
  readonly isLoading = signal(true);
  readonly filter = signal<'all' | 'active' | 'inactive'>('all');
  readonly roleFilter = signal<string>('all');
  readonly editingUser = signal<AdminUser | null>(null);
  readonly isSaving = signal(false);
  readonly avatarAttemptIndex = signal<Map<string, number>>(new Map());

  editForm = {
    name: '',
    email: '',
    phone: '',
    role: ''
  };

  readonly roles = ['ADMIN', 'CLUB', 'COACH', 'PARENT'];

  get filteredUsers(): AdminUser[] {
    let all = this.users();

    // Filter by status
    switch (this.filter()) {
      case 'active':
        all = all.filter(u => u.enabled);
        break;
      case 'inactive':
        all = all.filter(u => !u.enabled);
        break;
    }

    // Filter by role
    if (this.roleFilter() !== 'all') {
      all = all.filter(u => u.role === this.roleFilter());
    }

    return all;
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  setFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.filter.set(filter);
  }

  setRoleFilter(role: string): void {
    this.roleFilter.set(role);
  }

  startEdit(user: AdminUser): void {
    // For COACH users, redirect to dedicated edit page
    if (user.role === 'COACH') {
      void this.router.navigate(['/admin/coaches', user.id, 'edit']);
      return;
    }

    // For CLUB users, redirect to dedicated club edit page
    if (user.role === 'CLUB' && user.clubId) {
      void this.router.navigate(['/admin/clubs', user.clubId]);
      return;
    }

    // For PARENT users, redirect to dedicated parent edit page with children
    if (user.role === 'PARENT') {
      void this.router.navigate(['/admin/users', user.id, 'edit']);
      return;
    }

    this.editingUser.set(user);
    this.editForm = {
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role
    };
  }

  cancelEdit(): void {
    this.editingUser.set(null);
  }

  saveUser(): void {
    const user = this.editingUser();
    if (!user) return;

    this.isSaving.set(true);
    const payload: UpdateUserPayload = {
      name: this.editForm.name,
      email: this.editForm.email,
      phone: this.editForm.phone || undefined,
      role: this.editForm.role
    };

    this.adminService
      .updateUser(user.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.editingUser.set(null);
          this.snackbar.open(`Utilizatorul "${payload.name}" a fost actualizat`, undefined, { duration: 3000 });
          this.loadUsers();
        },
        error: (err) => {
          this.isSaving.set(false);
          const message = err?.error?.message || 'Nu am putut actualiza utilizatorul';
          this.snackbar.open(message, undefined, { duration: 5000 });
        }
      });
  }

  toggleUserStatus(user: AdminUser): void {
    const newStatus = !user.enabled;
    const action = newStatus ? 'activat' : 'dezactivat';

    this.adminService
      .setUserStatus(user.id, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open(`Utilizatorul "${user.name}" a fost ${action}`, undefined, { duration: 3000 });
          this.loadUsers();
        },
        error: (err) => {
          const message = err?.error?.message || `Nu am putut ${newStatus ? 'activa' : 'dezactiva'} utilizatorul`;
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  deleteUser(user: AdminUser): void {
    const dialogData: DeleteUserDialogData = {
      userName: user.name,
      userEmail: user.email,
      childrenCount: user.childrenCount,
      enrollmentsCount: user.enrollmentsCount,
      role: user.role
    };

    const dialogRef = this.dialog.open(DeleteUserDialogComponent, {
      data: dialogData,
      panelClass: 'premium-dialog-panel',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: DeleteUserDialogResult) => {
      if (result?.confirmed) {
        this.performDelete(user, result.force);
      }
    });
  }

  private performDelete(user: AdminUser, force: boolean): void {
    this.adminService
      .deleteUser(user.id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Utilizatorul a fost șters cu succes', undefined, { duration: 4000 });
          this.loadUsers();
        },
        error: (err) => {
          if (err.status === 409 && !force) {
            // Show force delete dialog
            const dialogData: DeleteUserDialogData = {
              userName: user.name,
              userEmail: user.email,
              childrenCount: user.childrenCount,
              enrollmentsCount: user.enrollmentsCount,
              role: user.role,
              isForceDelete: true
            };

            const dialogRef = this.dialog.open(DeleteUserDialogComponent, {
              data: dialogData,
              panelClass: 'premium-dialog-panel',
              disableClose: true
            });

            dialogRef.afterClosed().subscribe((result: DeleteUserDialogResult) => {
              if (result?.confirmed) {
                this.performDelete(user, true);
              }
            });
            return;
          }

          const message = err.error?.message || 'Nu am putut șterge utilizatorul';
          this.snackbar.open(message, undefined, { duration: 5000 });
        }
      });
  }

  private loadUsers(): void {
    this.isLoading.set(true);
    this.adminService
      .getAllUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.isLoading.set(false);
        },
        error: () => {
          this.users.set([]);
          this.isLoading.set(false);
          this.snackbar.open('Nu am putut încărca lista de utilizatori', undefined, { duration: 4000 });
        }
      });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'ADMIN': return 'badge--error';
      case 'CLUB': return 'badge--club';
      case 'COACH': return 'badge--coach';
      case 'PARENT': return 'badge--primary';
      default: return 'badge--primary';
    }
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'ADMIN': return 'Administrator';
      case 'CLUB': return 'Club';
      case 'COACH': return 'Antrenor';
      case 'PARENT': return 'Părinte';
      default: return role;
    }
  }

  getActiveCount(): number {
    return this.users().filter(u => u.enabled).length;
  }

  getParentsCount(): number {
    return this.users().filter(u => u.role === 'PARENT').length;
  }

  getTotalChildren(): number {
    return this.users().reduce((sum, u) => sum + u.childrenCount, 0);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  onAvatarError(user: AdminUser): void {
    const candidates = this.getAvatarCandidates(user);
    if (candidates.length === 0) {
      return;
    }

    this.avatarAttemptIndex.update((map) => {
      const next = new Map(map);
      const current = next.get(user.id) ?? 0;
      const nextIndex = current + 1;
      next.set(user.id, nextIndex);
      return next;
    });
  }

  getResolvedAvatarUrl(user: AdminUser): string | null {
    const candidates = this.getAvatarCandidates(user);
    if (candidates.length === 0) {
      return null;
    }

    const idx = this.avatarAttemptIndex().get(user.id) ?? 0;
    if (idx < 0 || idx >= candidates.length) {
      return null;
    }

    return candidates[idx];
  }

  private getAvatarCandidates(user: AdminUser): string[] {
    const candidates: string[] = [];

    // Prefer role-specific images first (coach photo / club logo), then fall back to user.avatarUrl.
    if (user.role === 'COACH') {
      candidates.push(this.adminService.getCoachPhotoUrl(user.id));
    }

    if (user.role === 'CLUB' && user.clubId) {
      candidates.push(this.adminService.getClubLogoUrl(user.clubId));
    }

    const normalized = this.normalizeAvatarUrl(user.avatarUrl);
    if (normalized) {
      candidates.push(normalized);
    }

    // De-duplicate while preserving order
    const seen = new Set<string>();
    return candidates.filter((u) => {
      if (!u) return false;
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }

  private normalizeAvatarUrl(avatarUrl: string | null | undefined): string | null {
    const url = (avatarUrl || '').trim();
    if (!url) return null;

    // If already absolute URL (or has a scheme), return as is
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      return url;
    }

    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    if (!base) {
      return path;
    }

    return `${base}${path}`;
  }
}
