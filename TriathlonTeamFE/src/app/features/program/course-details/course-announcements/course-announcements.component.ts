import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit, AfterViewInit, Signal, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AnnouncementsService, AnnouncementDto } from '../../../../core/services/announcements.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ImageOnlyPipe } from '../../../../shared/pipes/image-only.pipe';
import { VideoOnlyPipe } from '../../../../shared/pipes/video-only.pipe';
import { VideoEmbedComponent } from '../../../../shared/components/video-embed/video-embed.component';
import { LightboxComponent } from '../../../../shared/components/lightbox/lightbox.component';

@Component({
  selector: 'app-course-announcements',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    MatIconModule,
    MatButtonModule,
    DatePipe,
    ImageOnlyPipe,
    VideoOnlyPipe,
    VideoEmbedComponent,
    LightboxComponent
  ],
  templateUrl: './course-announcements.component.html',
  styleUrls: ['./course-announcements.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseAnnouncementsComponent implements OnInit, AfterViewInit {
  private readonly api = inject(AnnouncementsService);
  private readonly auth = inject(AuthService);

  @Input() courseId!: string;
  @Input() courseName: string | null = null;

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly feed = signal<AnnouncementDto[]>([]);
  readonly isParentLoggedIn = computed(() => this.auth.isLoggedIn() && this.auth.getCurrentUser()?.role === 'PARENT');
  readonly isForbidden = signal(false);

  readonly hasNew = computed(() => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return this.feed().some(a => new Date(a.createdAt).getTime() >= now - sevenDays);
  });

  readonly pageSize = 10;
  readonly displayCount = signal(this.pageSize);
  readonly visibleFeed = computed(() => this.feed().slice(0, this.displayCount()));

  // Lightbox state
  readonly lightboxOpen = signal(false);
  readonly lightboxImages = signal<string[]>([]);
  readonly lightboxIndex = signal(0);

  @ViewChild('infiniteAnchor') anchor?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (!this.courseId) {
      this.isLoading.set(false);
      this.hasError.set(true);
      return;
    }
    if (!this.isParentLoggedIn()) {
      this.isLoading.set(false);
      this.hasError.set(false);
      return;
    }
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

  private load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.api.listParentCourse(this.courseId).subscribe({
      next: (items) => {
        this.feed.set(items);
        this.isLoading.set(false);
        this.displayCount.set(this.pageSize);
      },
      error: (err) => {
        this.feed.set([]);
        this.isLoading.set(false);
        this.hasError.set(true);
        if ((err as any)?.status === 403) {
          this.isForbidden.set(true);
          this.hasError.set(false);
        }
      }
    });
  }

  imageUrl(a: AnnouncementDto, attId: string): string {
    return this.api.getParentImageUrl(this.courseId, a.id, attId);
  }

  videoUrl(a: AnnouncementDto, attId: string): string {
    return this.api.getParentVideoUrl(this.courseId, a.id, attId);
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
