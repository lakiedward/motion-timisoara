import { Component, Input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

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
  private readonly apiBaseUrl = inject<string>(API_BASE_URL);
  
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

    // Ensure base URL has no trailing slash
    const base = (this.apiBaseUrl || '').replace(/\/$/, '');
    if (!base) return url; // fallback to original relative (same-origin)

    // Ensure URL starts with a slash
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }
}
