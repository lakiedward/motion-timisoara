import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../../core/components/header/header.component';

// ============================================
// COACH LAYOUT - Using Unified Header
// Mirrors AdminLayoutComponent pattern
// ============================================

@Component({
  selector: 'app-coach-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './coach-layout.component.html',
  styleUrls: ['./coach-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachLayoutComponent {
  // Layout is now purely structural
  // Navigation is handled by the unified HeaderComponent
}

