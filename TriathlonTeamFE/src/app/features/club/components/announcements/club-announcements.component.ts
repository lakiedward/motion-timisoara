import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ClubService, ClubAnnouncement } from '../../services/club.service';

@Component({
  selector: 'app-club-announcements',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './club-announcements.component.html',
  styleUrls: ['./club-announcements.component.scss']
})
export class ClubAnnouncementsComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  private readonly clubService = inject(ClubService);

  readonly announcements = signal<ClubAnnouncement[]>([]);
  readonly isLoading = signal(true);
  readonly showAddForm = signal(false);
  readonly isSubmitting = signal(false);

  // Form data
  newAnnouncement = {
    title: '',
    content: '',
    priority: 'NORMAL'
  };

  ngOnInit(): void {
    this.loadAnnouncements();
  }

  private loadAnnouncements(): void {
    this.isLoading.set(true);
    this.clubService.getAnnouncements().subscribe({
      next: (announcements) => {
        this.announcements.set(announcements);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading announcements:', err);
        this.isLoading.set(false);
      }
    });
  }

  addAnnouncement(): void {
    this.showAddForm.set(true);
  }

  cancelAdd(): void {
    this.showAddForm.set(false);
    this.resetForm();
  }

  submitAnnouncement(): void {
    if (!this.newAnnouncement.title.trim() || !this.newAnnouncement.content.trim()) {
      this.snackBar.open('Titlul și conținutul sunt obligatorii', 'OK', { duration: 3000 });
      return;
    }

    this.isSubmitting.set(true);
    this.clubService.createAnnouncement({
      title: this.newAnnouncement.title,
      content: this.newAnnouncement.content,
      priority: this.newAnnouncement.priority
    }).subscribe({
      next: (announcement) => {
        this.announcements.update(list => [announcement, ...list]);
        this.snackBar.open('Anunț creat cu succes!', 'OK', { duration: 3000 });
        this.showAddForm.set(false);
        this.resetForm();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        console.error('Error creating announcement:', err);
        this.snackBar.open('Eroare la crearea anunțului', 'OK', { duration: 3000 });
        this.isSubmitting.set(false);
      }
    });
  }

  toggleStatus(announcement: ClubAnnouncement): void {
    this.clubService.updateAnnouncement(announcement.id, {
      isActive: !announcement.isActive
    }).subscribe({
      next: (updated) => {
        this.announcements.update(list =>
          list.map(a => a.id === updated.id ? updated : a)
        );
        this.snackBar.open(
          updated.isActive ? 'Anunț activat' : 'Anunț dezactivat',
          'OK',
          { duration: 2000 }
        );
      },
      error: (err) => {
        console.error('Error updating announcement:', err);
        this.snackBar.open('Eroare la actualizare', 'OK', { duration: 3000 });
      }
    });
  }

  deleteAnnouncement(announcement: ClubAnnouncement): void {
    if (!confirm(`Sigur doriți să ștergeți anunțul "${announcement.title}"?`)) {
      return;
    }

    this.clubService.deleteAnnouncement(announcement.id).subscribe({
      next: () => {
        this.announcements.update(list => list.filter(a => a.id !== announcement.id));
        this.snackBar.open('Anunț șters', 'OK', { duration: 2000 });
      },
      error: (err) => {
        console.error('Error deleting announcement:', err);
        this.snackBar.open('Eroare la ștergere', 'OK', { duration: 3000 });
      }
    });
  }

  private resetForm(): void {
    this.newAnnouncement = { title: '', content: '', priority: 'NORMAL' };
  }

  getActiveAnnouncements(): number {
    return this.announcements().filter(a => a.isActive).length;
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'priority_high';
      case 'HIGH': return 'arrow_upward';
      case 'LOW': return 'arrow_downward';
      default: return 'remove';
    }
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'Urgent';
      case 'HIGH': return 'Ridicat';
      case 'LOW': return 'Scăzut';
      default: return 'Normal';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
