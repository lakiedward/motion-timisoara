import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  DestroyRef,
  PLATFORM_ID,
  inject,
  signal,
  HostListener
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CampSummary, PublicApiService } from '../../../core/services/public-api.service';
import { ScrollRevealDirective, ImageFallbackDirective } from '../../../shared/directives';

@Component({
  selector: 'app-camps',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    NgIf,
    CurrencyPipe,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    ScrollRevealDirective,
    ImageFallbackDirective
  ],
  templateUrl: './camps.component.html',
  styleUrls: ['./camps.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampsComponent implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly camps = signal<CampSummary[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal(false);
  scrollProgress = 0;

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    this.loadCamps();
  }

  @HostListener('window:scroll')
  handleScroll(): void {
    if (!this.isBrowser) {
      return;
    }

    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      this.scrollProgress = Math.min(100, Math.max(0, (scrollY / maxScroll) * 100));
    } else {
      this.scrollProgress = 0;
    }
  }

  trackBySlug(_: number, camp: CampSummary): string {
    return camp.slug;
  }

  private loadCamps(): void {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading.set(true);
    this.api
      .getCamps()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.camps.set(response ?? []);
          this.error.set(false);
        },
        error: () => {
          this.camps.set([]);
          this.error.set(true);
        }
      });
  }
}
