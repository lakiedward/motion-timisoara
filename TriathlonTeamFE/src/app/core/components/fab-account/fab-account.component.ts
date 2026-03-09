import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-fab-account',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatTooltipModule],
  template: `
    <a 
      *ngIf="isLoggedIn()" 
      class="fab-account"
      routerLink="/account"
      matTooltip="Contul meu"
      matTooltipPosition="left"
      aria-label="Deschide contul meu">
      <mat-icon>account_circle</mat-icon>
    </a>
  `,
  styleUrls: ['./fab-account.component.scss']
})
export class FabAccountComponent {
  private readonly authService = inject(AuthService);
  
  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }
}

