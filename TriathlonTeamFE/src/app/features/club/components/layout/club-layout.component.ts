import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../../core/components/header/header.component';

@Component({
  selector: 'app-club-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './club-layout.component.html',
  styleUrls: ['./club-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubLayoutComponent {}
