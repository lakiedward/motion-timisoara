import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoachSummary } from '../../../../core/services/public-api.service';
import { SupabaseService } from '../../../../core/services/supabase.service';

interface SportConfig {
  icon: string;
  label: string;
  accent: 'blue' | 'indigo' | 'cyan' | 'purple';
}

@Component({
  selector: 'app-coach-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-card.component.html',
  styleUrls: ['./coach-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachCardComponent {
  private readonly supabase = inject(SupabaseService);
  
  @Input({ required: true }) coach!: CoachSummary;
  @Input() showSummary = true;
  @Output() viewProfile = new EventEmitter<string>();
  
  photoFailed = false;

  private readonly sportConfigs: Record<string, SportConfig> = {
    swim: { icon: '🏊', label: 'Înot', accent: 'blue' },
    bike: { icon: '🚴', label: 'Ciclism', accent: 'cyan' },
    run: { icon: '🏃', label: 'Alergare', accent: 'indigo' },
    ski: { icon: '⛷️', label: 'Ski', accent: 'cyan' },
    multisport: { icon: '🏆', label: 'Multisport', accent: 'indigo' },
    triatlon: { icon: '🏊🚴🏃', label: 'Triatlon', accent: 'purple' },
    general: { icon: '⚡', label: 'General', accent: 'blue' }
  };

  get coachPhotoUrl(): string {
    const { data } = this.supabase.storage('coach-photos').getPublicUrl(this.coach.id);
    return data?.publicUrl ?? '';
  }

  get sportsBadgeText(): string {
    if (this.coach.disciplines.length === 0) {
      return 'Antrenor';
    }
    if (this.coach.disciplines.length === 1) {
      return this.coach.disciplines[0].sport.name;
    }
    return `${this.coach.disciplines.length} sporturi`;
  }

  get primarySportConfig(): SportConfig {
    if (this.coach.disciplines.length > 0) {
      const sportCode = this.coach.disciplines[0].sport.code?.toLowerCase() ?? 'general';
      return this.sportConfigs[sportCode] ?? this.sportConfigs['general'];
    }
    return this.sportConfigs['general'];
  }

  get accentClass(): string {
    return `accent-${this.primarySportConfig.accent}`;
  }

  get locationsText(): string {
    if (this.coach.locations.length === 0) {
      return '';
    }
    return this.coach.locations.map(loc => loc.name).join(', ');
  }

  getSportIcon(sportCode?: string): string {
    if (!sportCode) return this.sportConfigs['general'].icon;
    const code = sportCode.toLowerCase();
    return this.sportConfigs[code]?.icon ?? this.sportConfigs['general'].icon;
  }

  onPhotoError(event: Event): void {
    // Fallback to default image
    (event.target as HTMLImageElement).src = '/ui/IMG-20190805-WA0023.jpg';
  }

  onCardClick(): void {
    this.viewProfile.emit(this.coach.id);
  }

  onViewProfile(event: Event): void {
    event.stopPropagation();
    this.viewProfile.emit(this.coach.id);
  }
}

