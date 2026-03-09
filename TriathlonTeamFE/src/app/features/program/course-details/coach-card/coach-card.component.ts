import { Component, Input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SupabaseService } from '../../../../core/services/supabase.service';

interface Coach {
  id: string;
  name: string;
  avatarUrl?: string;
  summary?: string;
  biography?: string;
  focusAreas?: string[];
}

@Component({
  selector: 'app-coach-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './coach-card.component.html',
  styleUrls: ['./coach-card.component.scss']
})
export class CoachCardComponent {
  private readonly supabase = inject(SupabaseService);
  
  @Input({ required: true }) coach!: Coach;
  @Input() showHeader = false;

  readonly isExpanded = signal(false);
  
  readonly resolvedAvatarUrl = computed(() => {
    const url = this.coach.avatarUrl;
    if (!url) return null;
    return this.resolveUrl(url);
  });
  
  readonly shortBio = computed(() => {
    const bio = this.coach.biography;
    if (!bio) return '';
    
    const words = bio.split(' ');
    if (words.length <= 30) return bio;
    
    return words.slice(0, 30).join(' ') + '...';
  });

  readonly shouldShowReadMore = computed(() => {
    const bio = this.coach.biography;
    return bio && bio.split(' ').length > 30;
  });

  readonly displayBio = computed(() => {
    return this.isExpanded() ? this.coach.biography : this.shortBio();
  });

  toggleBio(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  getCoachInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getCoachLink(): string[] {
    return ['/antrenori', this.coach.id];
  }

  trackByArea(index: number, area: string): string {
    return area;
  }

  private resolveUrl(url: string): string {
    if (!url) return url;
    // If already absolute, return as is
    if (/^https?:\/\//i.test(url)) return url;

    // Relative path: resolve via Supabase storage
    const { data } = this.supabase.storage('coach-photos').getPublicUrl(url);
    return data?.publicUrl ?? url;
  }
}
