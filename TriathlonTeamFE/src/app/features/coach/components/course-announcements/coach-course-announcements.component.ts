import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnnouncementsService, AnnouncementDto } from '../../../../core/services/announcements.service';
import { PublicApiService } from '../../../../core/services/public-api.service';
import { ImageOnlyPipe } from '../../../../shared/pipes/image-only.pipe';
import { VideoOnlyPipe } from '../../../../shared/pipes/video-only.pipe';
import { VideoEmbedComponent } from '../../../../shared/components/video-embed/video-embed.component';

interface SelectedImage {
  file: File;
  dataUrl: string;
}

interface SelectedVideo {
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'app-coach-course-announcements',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatTooltipModule,
    DatePipe,
    ImageOnlyPipe,
    VideoOnlyPipe,
    VideoEmbedComponent
  ],
  templateUrl: './coach-course-announcements.component.html',
  styleUrls: ['./coach-course-announcements.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachCourseAnnouncementsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AnnouncementsService);
  private readonly publicApi = inject(PublicApiService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly courseId = signal<string>('');
  readonly courseName = signal<string>('');

  // List state
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly list = signal<AnnouncementDto[]>([]);
  readonly sortedList = computed(() => {
    const items = [...this.list()];
    return items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  // Composer state
  readonly content = signal('');
  readonly selectedImages = signal<SelectedImage[]>([]);
  readonly selectedVideos = signal<SelectedVideo[]>([]);
  readonly videoUrls = signal<string[]>(['']);
  readonly pinAfterPost = signal(false);
  readonly isPosting = signal(false);

  readonly maxImages = 10;
  readonly maxVideoLinks = 2;
  readonly maxVideos = 2;
  readonly maxImageSizeBytes = 4 * 1024 * 1024; // 4MB
  readonly maxVideoSizeBytes = 150 * 1024 * 1024; // 150MB

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.courseId.set(id);
        this.loadCourseName(id);
        this.load();
      } else {
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    });
  }

  private loadCourseName(id: string): void {
    this.publicApi.getCourse(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (course) => this.courseName.set(course.name),
      error: () => this.courseName.set('Curs')
    });
  }

  private load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.api.listCoach(this.courseId()).subscribe({
      next: (items) => {
        this.list.set(items || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.list.set([]);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.snackbar.open('Nu am putut încărca anunțurile', undefined, { duration: 4000 });
      }
    });
  }

  // Composer actions
  canPost(): boolean {
    const hasContent = this.content().trim().length > 0;
    const hasAnyAttachment =
      this.selectedImages().length > 0 ||
      this.selectedVideos().length > 0 ||
      this.videoUrls().some(v => (v || '').trim().length > 0);
    return hasContent || hasAnyAttachment;
  }

  onSelectImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const current = this.selectedImages();

    if (current.length + files.length > this.maxImages) {
      this.snackbar.open(`Poți atașa maxim ${this.maxImages} imagini`, undefined, { duration: 4000 });
      input.value = '';
      return;
    }

    const toRead: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        this.snackbar.open('Doar fișiere imagine sunt permise', undefined, { duration: 4000 });
        continue;
      }
      if (file.size > this.maxImageSizeBytes) {
        this.snackbar.open('Imagine prea mare. Max 4MB per fișier', undefined, { duration: 4000 });
        continue;
      }
      toRead.push(file);
    }

    let readCount = 0;
    toRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        readCount++;
        this.selectedImages.update((arr) => [...arr, { file, dataUrl: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  removeSelectedImage(index: number): void {
    this.selectedImages.update(arr => arr.filter((_, i) => i !== index));
  }

  onSelectVideos(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const currentVideos = this.selectedVideos();
    const currentUrls = this.videoUrls().map(v => (v || '').trim()).filter(v => v);

    if (currentVideos.length + currentUrls.length + files.length > this.maxVideos) {
      this.snackbar.open(`Poți atașa maxim ${this.maxVideos} videoclipuri (link sau fișier)`, undefined, { duration: 4000 });
      input.value = '';
      return;
    }

    const validVideos: SelectedVideo[] = [];
    for (const file of files) {
      if (!file.type.startsWith('video/')) {
        this.snackbar.open('Doar fișiere video sunt permise', undefined, { duration: 4000 });
        continue;
      }
      if (file.size > this.maxVideoSizeBytes) {
        this.snackbar.open('Videoclip prea mare. Max 150MB per fișier', undefined, { duration: 4000 });
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      validVideos.push({ file, previewUrl });
    }

    if (validVideos.length) {
      this.selectedVideos.update(arr => [...arr, ...validVideos]);
    }

    input.value = '';
  }

  removeSelectedVideo(index: number): void {
    this.selectedVideos.update(arr => {
      const next = [...arr];
      const removed = next.splice(index, 1)[0];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  addVideoField(): void {
    if (this.videoUrls().length >= this.maxVideos) return;
    this.videoUrls.update(list => [...list, '']);
  }

  removeVideoField(index: number): void {
    const list = this.videoUrls();
    if (list.length <= 1) {
      this.videoUrls.set(['']);
      return;
    }
    this.videoUrls.update(arr => arr.filter((_, i) => i !== index));
  }

  updateVideoUrl(index: number, value: string): void {
    const arr = [...this.videoUrls()];
    arr[index] = value;
    this.videoUrls.set(arr);
  }

  post(pin = false): void {
    if (!this.canPost() || this.isPosting()) return;

    const images = this.selectedImages().map(i => i.dataUrl);
    const videoUrls = this.videoUrls().map(v => (v || '').trim()).filter(v => v);
    const videoFiles = this.selectedVideos();

    if (videoUrls.length + videoFiles.length > this.maxVideos) {
      this.snackbar.open(`Maxim ${this.maxVideos} videoclipuri (link sau fișier)`, undefined, { duration: 4000 });
      return;
    }

    this.isPosting.set(true);
    const basePayload = {
      content: this.content().trim(),
      images: images.length ? images : undefined,
      videoUrls: videoUrls.length ? videoUrls : undefined,
      pinAfterPost: pin || this.pinAfterPost()
    };

    const hasVideoFiles = videoFiles.length > 0;
    const request$ = hasVideoFiles
      ? this.api.createCoachWithFiles(this.courseId(), {
          ...basePayload,
          videoFiles: videoFiles.map(v => v.file)
        })
      : this.api.createCoach(this.courseId(), basePayload);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.open('Anunț publicat', undefined, { duration: 3000 });
          // cleanup
          this.selectedVideos().forEach(v => URL.revokeObjectURL(v.previewUrl));
          this.isPosting.set(false);
          // navigate to global announcements with course pre-selected
          this.router.navigate(['/coach/announcements'], { 
            queryParams: { course: this.courseId() } 
          });
        },
        error: (err) => {
          const msg = err?.error?.message || 'Nu am putut publica anunțul';
          this.snackbar.open(msg, undefined, { duration: 4000 });
          this.isPosting.set(false);
        }
      });
  }

  // Item actions
  togglePin(item: AnnouncementDto): void {
    const next = !item.pinned;
    this.api.setPinnedCoach(this.courseId(), item.id, next).subscribe({
      next: () => {
        this.list.update(arr => arr.map(a => (a.id === item.id ? { ...a, pinned: next } : a)));
      },
      error: () => this.snackbar.open('Nu am putut actualiza pin-ul', undefined, { duration: 3000 })
    });
  }

  delete(item: AnnouncementDto): void {
    if (!confirm('Ștergi acest anunț?')) return;
    this.api.deleteCoach(this.courseId(), item.id).subscribe({
      next: () => {
        this.list.update(arr => arr.filter(a => a.id !== item.id));
        this.snackbar.open('Anunț șters', undefined, { duration: 3000 });
      },
      error: () => this.snackbar.open('Nu am putut șterge anunțul', undefined, { duration: 4000 })
    });
  }

  imageUrl(a: AnnouncementDto, attId: string): string {
    return this.api.getCoachImageUrl(this.courseId(), a.id, attId);
  }

  videoUrl(a: AnnouncementDto, attId: string): string {
    return this.api.getCoachVideoUrl(this.courseId(), a.id, attId);
  }

  trackById(_: number, a: AnnouncementDto): string { return a.id; }
  trackAttId(_: number, att: { id: string }): string { return att.id; }
  trackByIndex(index: number): number { return index; }
}
