import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, Signal, ViewChild, ElementRef, AfterViewInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AnnouncementsService, AnnouncementDto } from '../../../../core/services/announcements.service';
import { MatButtonModule } from '@angular/material/button';
import { VideoEmbedComponent } from '../../../../shared/components/video-embed/video-embed.component';
import { LightboxComponent } from '../../../../shared/components/lightbox/lightbox.component';
import { ImageOnlyPipe } from '../../../../shared/pipes/image-only.pipe';
import { VideoOnlyPipe } from '../../../../shared/pipes/video-only.pipe';

@Component({
  selector: 'app-account-announcements',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    DatePipe,
    VideoEmbedComponent,
    ImageOnlyPipe,
    VideoOnlyPipe,
    LightboxComponent
  ],
  templateUrl: './announcements.component.html',
  styleUrls: ['./announcements.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountAnnouncementsComponent implements OnInit, AfterViewInit {
  private readonly api = inject(AnnouncementsService);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly feed = signal<AnnouncementDto[]>([]);

  readonly courses = computed(() => this.api.groupCoursesFromFeed(this.feed()));
  selectedCourseId = signal<string | null>(null);

  readonly pageSize = 20;
  readonly displayCount = signal(this.pageSize);
  readonly visibleFeed = computed(() => this.feed().slice(0, this.displayCount()));
  readonly hasMore = computed(() => this.feed().length > this.displayCount());
  readonly hasNew = computed(() => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return this.feed().some(a => new Date(a.createdAt).getTime() >= now - sevenDays);
  });

  // Lightbox state
  readonly lightboxOpen = signal(false);
  readonly lightboxImages = signal<string[]>([]);
  readonly lightboxIndex = signal(0);

  @ViewChild('infiniteAnchor') anchor?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const initialCourseId = this.route.snapshot.queryParamMap.get('courseId');
    this.selectedCourseId.set(initialCourseId);
    this.load();
  }

  ngAfterViewInit(): void {
    if (!('IntersectionObserver' in window)) return;
    this.observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          this.displayCount.set(this.displayCount() + this.pageSize);
        }
      }
    }, { root: null, threshold: 0.1 });
    if (this.anchor?.nativeElement) {
      this.observer.observe(this.anchor.nativeElement);
    }
  }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.api
      .listParentFeed({ courseId: this.selectedCourseId(), limit: 50 })
      .subscribe({
        next: (items) => {
          this.feed.set(items);
          this.isLoading.set(false);
          this.displayCount.set(this.pageSize);
          // Observe anchor if available after content renders
          queueMicrotask(() => {
            if (this.anchor?.nativeElement && this.observer) {
              this.observer.observe(this.anchor.nativeElement);
            }
          });
        },
        error: () => {
          this.feed.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
        }
      });
  }

  useChips(): boolean {
    return this.courses().length <= 6;
  }

  onSelectCourse(courseId: string | null) {
    this.selectedCourseId.set(courseId);
    this.load();
  }

  imageUrl(a: AnnouncementDto, attId: string): string {
    if (!a.courseId) return '';
    return this.api.getParentImageUrl(a.courseId, a.id, attId);
  }

  videoUrl(a: AnnouncementDto, attId: string): string {
    if (!a.courseId) return '';
    return this.api.getParentVideoUrl(a.courseId, a.id, attId);
  }

  imageUrlsFor(a: AnnouncementDto): string[] {
    const urls: string[] = [];
    a.attachments?.forEach(att => {
      if (att.image) {
        urls.push(this.imageUrl(a, att.id));
      }
    });
    return urls;
  }

  openLightbox(a: AnnouncementDto, index: number): void {
    const imgs = this.imageUrlsFor(a);
    if (!imgs.length) return;
    this.lightboxImages.set(imgs);
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  trackById(_: number, a: AnnouncementDto): string {
    return a.id;
  }

  trackAttId(_: number, att: { id: string }): string {
    return att.id;
  }
}
