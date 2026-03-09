import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { LoadingIndicatorService } from '../../services/loading-indicator.service';

@Component({
  selector: 'app-loader-overlay',
  standalone: true,
  imports: [NgIf, AsyncPipe, MatProgressSpinnerModule],
  templateUrl: './loader-overlay.component.html',
  styleUrls: ['./loader-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoaderOverlayComponent {
  private readonly loadingService = inject(LoadingIndicatorService);
  readonly isVisible$: Observable<boolean> = this.loadingService.isLoading$;
}
