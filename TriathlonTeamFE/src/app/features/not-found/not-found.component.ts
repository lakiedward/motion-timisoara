import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="not-found-container">
      <div class="not-found-content">
        <div class="error-code">404</div>
        <h1>Pagină negăsită</h1>
        <p>Ne pare rău, pagina pe care o cauți nu există sau a fost mutată.</p>
        
        <div class="actions">
          <button mat-raised-button color="primary" (click)="goHome()">
            <mat-icon>home</mat-icon>
            Înapoi la pagina principală
          </button>
          <button mat-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
            Înapoi
          </button>
        </div>

        <div class="suggestions">
          <h3>Îți sugerăm:</h3>
          <ul>
            <li><a [routerLink]="['/cursuri']">Vezi cursurile disponibile</a></li>
            <li><a [routerLink]="['/antrenori']">Cunoaște antrenorii</a></li>
            <li><a [routerLink]="['/contact']">Contactează-ne</a></li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      min-height: calc(100vh - 200px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }

    .not-found-content {
      max-width: 600px;
    }

    .error-code {
      font-size: 120px;
      font-weight: 700;
      color: var(--primary-color, #1976d2);
      line-height: 1;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #333;
    }

    p {
      font-size: 1.1rem;
      color: #666;
      margin-bottom: 2rem;
    }

    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .suggestions {
      text-align: left;
      background: #f5f5f5;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 2rem;
    }

    .suggestions h3 {
      margin-top: 0;
      color: #333;
      font-size: 1.2rem;
    }

    .suggestions ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .suggestions li {
      margin: 0.75rem 0;
    }

    .suggestions a {
      color: var(--primary-color, #1976d2);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s;
    }

    .suggestions a:hover {
      color: var(--primary-dark, #1565c0);
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      .error-code {
        font-size: 80px;
      }
      
      h1 {
        font-size: 1.5rem;
      }
      
      .actions {
        flex-direction: column;
      }
    }
  `]
})
export class NotFoundComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/']);
  }

  goBack(): void {
    window.history.back();
  }
}
