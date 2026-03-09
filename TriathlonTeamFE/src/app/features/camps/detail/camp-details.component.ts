import { CommonModule, CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { CampDetail, PublicApiService } from '../../../core/services/public-api.service';

type DescriptionBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

@Component({
  selector: 'app-camp-details',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, DatePipe, CurrencyPipe, MatButtonModule, MatIconModule],
  templateUrl: './camp-details.component.html',
  styleUrls: ['./camp-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PublicApiService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly camp = signal<CampDetail | null>(null);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly showPaymentOptions = signal(false);
  readonly descriptionBlocks = signal<DescriptionBlock[]>([]);

  readonly hasGallery = computed(() => (this.camp()?.gallery?.length ?? 0) > 0);
  readonly isSoldOut = computed(() => Boolean(this.camp()?.soldOut));

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const slug = params.get('slug');
          if (!slug) {
            this.hasError.set(true);
            this.isLoading.set(false);
            return EMPTY;
          }
          this.isLoading.set(true);
          this.hasError.set(false);
          this.camp.set(null);
          this.showPaymentOptions.set(false);
          return this.api.getCampBySlug(slug).pipe(finalize(() => this.isLoading.set(false)));
        })
      )
      .subscribe({
        next: (camp) => {
          this.camp.set(camp);
          this.descriptionBlocks.set(this.parseDescription(this.combineDescription(camp)));
        },
        error: () => {
          this.camp.set(null);
          this.hasError.set(true);
        }
      });
  }

  onEnroll(): void {
    const camp = this.camp();
    if (!camp || this.isSoldOut()) {
      return;
    }

    if (!this.authService.isLoggedIn()) {
      void this.router.navigate(['/login'], {
        queryParams: { redirect: `/tabere/${camp.slug}` }
      });
      return;
    }

    this.showPaymentOptions.set(true);
  }

  selectPayment(method: 'card' | 'cash'): void {
    const camp = this.camp();
    if (!camp) {
      return;
    }
    this.showPaymentOptions.set(false);
    const queryParams: Record<string, string> = {
      kind: 'CAMP',
      slug: camp.slug,
      payment: method
    };
    void this.router.navigate(['/account/checkout'], { queryParams });
  }

  cancelPaymentSelection(): void {
    this.showPaymentOptions.set(false);
  }

  trackByImage(_: number, url: string): string {
    return url;
  }

  private combineDescription(camp: CampDetail): string {
    const parts = [camp.summary, camp.description]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part && part.length > 0));
    return parts.join('\n\n');
  }

  private parseDescription(text?: string): DescriptionBlock[] {
    if (!text) {
      return [];
    }

    const lines = text.split(/\r?\n/);
    const blocks: DescriptionBlock[] = [];
    let paragraphBuffer: string[] = [];
    let listBuffer: string[] | null = null;

    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        blocks.push({ type: 'paragraph', text: paragraphBuffer.join(' ') });
        paragraphBuffer = [];
      }
    };

    const flushList = () => {
      if (listBuffer && listBuffer.length > 0) {
        blocks.push({ type: 'list', items: listBuffer });
      }
      listBuffer = null;
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        return;
      }

      if (line.startsWith('#')) {
        flushParagraph();
        flushList();
        const heading = line.replace(/^#+\s*/, '').trim();
        if (heading) {
          blocks.push({ type: 'heading', text: heading });
        }
        return;
      }

      if (line.endsWith(':') && !line.startsWith('-')) {
        flushParagraph();
        flushList();
        const heading = line.slice(0, -1).trim();
        if (heading) {
          blocks.push({ type: 'heading', text: heading });
        }
        return;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        flushParagraph();
        if (!listBuffer) {
          listBuffer = [];
        }
        listBuffer.push(line.substring(2).trim());
        return;
      }

      if (listBuffer) {
        flushList();
      }
      paragraphBuffer.push(line);
    });

    flushParagraph();
    flushList();

    if (blocks.length === 0) {
      return [{ type: 'paragraph', text: text }];
    }

    return blocks;
  }
}
