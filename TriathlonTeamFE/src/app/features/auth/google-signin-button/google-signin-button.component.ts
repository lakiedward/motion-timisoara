import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './google-signin-button.component.html',
  styleUrls: ['./google-signin-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleSigninButtonComponent {
  private readonly authService = inject(AuthService);

  @Input() label = 'Continua cu Google';
  @Input() redirectUrl: string | null = null;
  @Input() disabled = false;

  @Output() beforeRedirect = new EventEmitter<void>();

  onClick(): void {
    if (this.disabled) {
      return;
    }

    this.beforeRedirect.emit();
    this.authService.loginWithGoogle(this.redirectUrl ?? undefined);
  }
}

