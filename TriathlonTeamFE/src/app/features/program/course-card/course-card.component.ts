import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { ProgramCourse, SportType } from '../../../core/services/public-api.service';
import { SupabaseService } from '../../../core/services/supabase.service';

interface SportConfig {
  icon: string;
  label: string;
  accent: 'blue' | 'indigo' | 'cyan' | 'purple';
}

@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './course-card.component.html',
  styleUrls: ['./course-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseCardComponent {
  private readonly supabase = inject(SupabaseService);
  
  @Input({ required: true }) course!: ProgramCourse;
  @Output() viewDetails = new EventEmitter<string>();
  @Output() enroll = new EventEmitter<string>();
  photoFailed = false;

  private readonly sportConfigs: Record<string, SportConfig> = {
    swim: { icon: '🏊', label: 'Înot', accent: 'blue' },
    bike: { icon: '🚴', label: 'Ciclism', accent: 'cyan' },
    run: { icon: '🏃', label: 'Alergare', accent: 'indigo' },
    camp: { icon: '⛺', label: 'Tabără', accent: 'purple' },
    ski: { icon: '⛷️', label: 'Ski', accent: 'cyan' },
    multisport: { icon: '🏆', label: 'Multisport', accent: 'indigo' },
    general: { icon: '⚡', label: 'General', accent: 'blue' }
  };

  private readonly levelLabels: Record<string, string> = {
    beginner: 'Începător',
    intermediate: 'Intermediar',
    advanced: 'Avansat'
  };

  get occurrencesPreview() {
    const occurrences = this.course?.occurrences ?? [];
    if (occurrences.length === 0) return [];
    // Deduplicate by weekday to ensure we show unique days (e.g., Luni, Miercuri, Vineri)
    const seenDays = new Set<number>();
    const uniqueByDay = [] as typeof occurrences;
    for (const occ of occurrences) {
      const d = new Date(occ.startTime);
      // JS: 0=Sunday..6=Saturday; convert to 1..7 with 1=Monday
      let dow = d.getDay();
      if (dow === 0) dow = 7; // Sunday -> 7
      // else 1..6 already fine
      if (!seenDays.has(dow)) {
        seenDays.add(dow);
        uniqueByDay.push(occ);
      }
    }
    // Sort by day of week (Monday=1, Tuesday=2, ..., Sunday=7)
    uniqueByDay.sort((a, b) => {
      const dateA = new Date(a.startTime);
      const dateB = new Date(b.startTime);
      let dowA = dateA.getDay();
      let dowB = dateB.getDay();
      if (dowA === 0) dowA = 7;
      if (dowB === 0) dowB = 7;
      return dowA - dowB;
    });
    // Keep at most 7 unique days
    return uniqueByDay.slice(0, 7);
  }

  getDayName(dateString: string): string {
    const date = new Date(dateString);
    const dayIndex = date.getDay();
    const dayNames = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    return dayNames[dayIndex];
  }

  get heroBackgroundImage(): string {
    if (this.course?.heroPhotoUrl) {
      const fullUrl = this.resolveUrl(this.course.heroPhotoUrl);
      return `url('${fullUrl}')`;
    }
    // Fallback gradient based on sport type
    return `linear-gradient(135deg, var(--accent-color) 0%, var(--accent-gradient-end) 100%)`;
  }

  get ageRangeDisplay(): string | null {
    const ageMin = this.course?.ageMin;
    const ageMax = this.course?.ageMax;
    
    if (ageMin && ageMax) {
      return `${ageMin}-${ageMax} ani`;
    }
    if (ageMin) {
      return `${ageMin}+ ani`;
    }
    if (ageMax) {
      return `până la ${ageMax} ani`;
    }
    return null;
  }

  get descriptionSnippet(): string | null {
    if (!this.course?.description) {
      return null;
    }
    const maxLength = 120;
    const description = this.course.description.trim();
    if (description.length <= maxLength) {
      return description;
    }
    return description.substring(0, maxLength).trim() + '...';
  }

  get levelLabel(): string | null {
    if (!this.course?.level) {
      return null;
    }
    return this.levelLabels[this.course.level.toLowerCase()] || this.course.level;
  }

  get coachInitials(): string {
    const name = this.course?.coach?.name ?? '';
    if (!name) {
      return '';
    }
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  get sportConfig(): SportConfig {
    const sportKey = this.course?.sport?.code?.toLowerCase() ?? 'general';
    return this.sportConfigs[sportKey] ?? this.sportConfigs['general'];
  }

  get sportIcon(): string {
    return this.sportConfig.icon;
  }

  get sportLabel(): string {
    // Use the name from backend if available, otherwise fall back to local config
    return this.course?.sport?.name ?? this.sportConfig.label;
  }

  get accentClass(): string {
    return `accent-${this.sportConfig.accent}`;
  }

  get coachPhotoUrl(): string | null {
    if (this.photoFailed) {
      return null;
    }
    const avatar = this.course?.coach?.avatarUrl?.trim();
    if (avatar) {
      return this.resolveUrl(avatar);
    }
    const coachId = this.course?.coach?.id;
    if (coachId) {
      const { data } = this.supabase.storage('coach-photos').getPublicUrl(coachId);
      return data?.publicUrl ?? null;
    }
    return null;
  }

  private resolveUrl(url: string): string {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const { data } = this.supabase.storage('course-photos').getPublicUrl(url);
    return data?.publicUrl ?? url;
  }

  onCoachPhotoError(): void {
    this.photoFailed = true;
  }

  onCardClick(): void {
    // Navigate to details when clicking anywhere on the card
    this.viewDetails.emit(this.course.id);
  }

  onViewDetails(event: Event): void {
    // Prevent event bubbling to avoid double navigation from card click
    event.stopPropagation();
    this.viewDetails.emit(this.course.id);
  }

  onEnroll(event: Event): void {
    // Prevent event bubbling to card click handler
    event.stopPropagation();
    this.enroll.emit(this.course.id);
  }
}
