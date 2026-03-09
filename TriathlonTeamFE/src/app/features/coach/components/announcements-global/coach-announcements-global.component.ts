import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachService, CoachCourseSummary } from '../../services/coach.service';
import { AnnouncementsService, AnnouncementDto } from '../../../../core/services/announcements.service';
import { ImageOnlyPipe } from '../../../../shared/pipes/image-only.pipe';
import { VideoOnlyPipe } from '../../../../shared/pipes/video-only.pipe';
import { VideoEmbedComponent } from '../../../../shared/components/video-embed/video-embed.component';

interface AnnouncementWithCourse extends AnnouncementDto { courseId: string; courseName?: string | null }

interface SelectedImage {
  file: File;
  dataUrl: string;
}

interface SelectedVideo {
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'app-coach-announcements-global',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    ImageOnlyPipe,
    VideoOnlyPipe,
    VideoEmbedComponent
  ],
  templateUrl: './coach-announcements-global.component.html',
  styleUrls: ['./coach-announcements-global.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachAnnouncementsGlobalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly coachService = inject(CoachService);
  private readonly api = inject(AnnouncementsService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly courses = signal<CoachCourseSummary[]>([]);
  readonly selectedCourseId = signal<string | 'all'>('all');

  // Composer state for "all courses"
  readonly showComposer = signal(false);
  readonly composerContent = signal('');
  readonly selectedImages = signal<SelectedImage[]>([]);
  readonly selectedVideos = signal<SelectedVideo[]>([]);
  readonly videoUrls = signal<string[]>(['']);
  readonly isPosting = signal(false);

  readonly maxImages = 10;
  readonly maxVideoLinks = 2;
  readonly maxVideos = 2;
  readonly maxImageSizeBytes = 4 * 1024 * 1024; // 4MB
  readonly maxVideoSizeBytes = 150 * 1024 * 1024; // 150MB

  readonly list = signal<AnnouncementWithCourse[]>([]);
  readonly sorted = computed(() => {
    const items = [...this.list()];
    return items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  // Stats helpers
  getPinnedCount(): number {
    return this.list().filter(a => a.pinned).length;
  }

  getRecentCount(): number {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return this.list().filter(a => new Date(a.createdAt) >= weekAgo).length;
  }

  ngOnInit(): void {
    this.loadCourses();
  }

  private loadCourses(): void {
    this.isLoading.set(true);
    this.coachService.getMyCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (courses) => {
          this.courses.set(courses ?? []);
          // Check for pre-selected course from query param
          const courseParam = this.route.snapshot.queryParamMap.get('course');
          if (courseParam && courses?.some(c => c.id === courseParam)) {
            this.selectedCourseId.set(courseParam);
          }
          this.isLoading.set(false);
          this.loadAnnouncements();
        },
        error: () => {
          this.courses.set([]);
          this.isLoading.set(false);
          this.hasError.set(true);
          this.snackbar.open('Nu am putut încărca lista de cursuri', undefined, { duration: 4000 });
        }
      });
  }

  loadAnnouncements(): void {
    const courses = this.courses();
    const selected = this.selectedCourseId();
    const targets = selected === 'all' ? courses : courses.filter(c => c.id === selected);

    if (!targets.length) {
      this.list.set([]);
      return;
    }

    this.isLoading.set(true);
    forkJoin(
      targets.map(c => this.api.listCoach(c.id).pipe(switchMap(items => of(items.map(a => ({ ...a, courseId: c.id, courseName: c.name } as AnnouncementWithCourse))))) )
    )
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (arr) => {
        const merged = arr.flat();
        this.list.set(merged);
        this.isLoading.set(false);
        this.hasError.set(false);
      },
      error: () => {
        this.list.set([]);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.snackbar.open('Nu am putut încărca anunțurile', undefined, { duration: 4000 });
      }
    });
  }

  onCourseChange(val: string): void {
    this.selectedCourseId.set(val as any);
    this.loadAnnouncements();
  }

  // Actions
  togglePin(item: AnnouncementWithCourse): void {
    const next = !item.pinned;
    this.api.setPinnedCoach(item.courseId, item.id, next).subscribe({
      next: () => this.list.update(arr => arr.map(a => a.id === item.id ? { ...a, pinned: next } : a)),
      error: () => this.snackbar.open('Nu am putut actualiza pin-ul', undefined, { duration: 3000 })
    });
  }

  delete(item: AnnouncementWithCourse): void {
    if (!confirm('Ștergi acest anunț?')) return;
    this.api.deleteCoach(item.courseId, item.id).subscribe({
      next: () => {
        this.list.update(arr => arr.filter(a => a.id !== item.id));
        this.snackbar.open('Anunț șters', undefined, { duration: 3000 });
      },
      error: () => this.snackbar.open('Nu am putut șterge anunțul', undefined, { duration: 4000 })
    });
  }

  createAnnouncement(): void {
    const selected = this.selectedCourseId();
    if (selected && selected !== 'all') {
      this.router.navigate(['/coach/courses', selected, 'announcements']);
    } else if (this.courses().length) {
      // Show composer for all courses and reset state
      this.showComposer.set(true);
      this.resetComposer();
    } else {
      this.snackbar.open('Nu ai cursuri disponibile', undefined, { duration: 3000 });
    }
  }

  resetComposer(): void {
    this.composerContent.set('');
    this.selectedImages.set([]);
    this.selectedVideos.update(arr => {
      arr.forEach(v => URL.revokeObjectURL(v.previewUrl));
      return [];
    });
    this.videoUrls.set(['']);
  }

  canPost(): boolean {
    const hasContent = this.composerContent().trim().length > 0;
    const hasAnyAttachment =
      this.selectedImages().length > 0 ||
      this.selectedVideos().length > 0 ||
      this.videoUrls().some(v => (v || '').trim().length > 0);
    return hasContent || hasAnyAttachment;
  }

  // Image handling
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

    toRead.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        this.selectedImages.update(arr => [...arr, { file, dataUrl: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  removeSelectedImage(index: number): void {
    this.selectedImages.update(arr => arr.filter((_, i) => i !== index));
  }

  // Video file handling
  onSelectVideos(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const current = this.selectedVideos();
    const totalVideos = current.length + this.videoUrls().filter(v => v.trim()).length;

    if (totalVideos + files.length > this.maxVideos) {
      this.snackbar.open(`Maxim ${this.maxVideos} videoclipuri (link sau fișier)`, undefined, { duration: 4000 });
      input.value = '';
      return;
    }

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
      this.selectedVideos.update(arr => [...arr, { file, previewUrl }]);
    }

    input.value = '';
  }

  removeSelectedVideo(index: number): void {
    this.selectedVideos.update(arr => {
      const next = [...arr];
      const removed = next.splice(index, 1)[0];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // Video URL handling
  addVideoField(): void {
    if (this.videoUrls().length >= this.maxVideos) return;
    this.videoUrls.update(list => [...list, '']);
  }

  removeVideoField(index: number): void {
    if (this.videoUrls().length <= 1) {
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

  trackByIndex(index: number): number { return index; }

  postToAllCourses(): void {
    if (!this.canPost() || !this.courses().length) return;

    const images = this.selectedImages().map(i => i.dataUrl);
    const videoUrls = this.videoUrls().map(v => (v || '').trim()).filter(v => v);
    const videoFiles = this.selectedVideos();

    if (videoUrls.length + videoFiles.length > this.maxVideos) {
      this.snackbar.open(`Maxim ${this.maxVideos} videoclipuri (link sau fișier)`, undefined, { duration: 4000 });
      return;
    }

    this.isPosting.set(true);
    const courseIds = this.courses().map(c => c.id);

    const basePayload = {
      content: this.composerContent().trim(),
      images: images.length ? images : undefined,
      videoUrls: videoUrls.length ? videoUrls : undefined
    };

    // Post to all courses in parallel (with files if any)
    const hasVideoFiles = videoFiles.length > 0;
    const requests = courseIds.map(courseId =>
      hasVideoFiles
        ? this.api.createCoachWithFiles(courseId, { ...basePayload, videoFiles: videoFiles.map(v => v.file) })
        : this.api.createCoach(courseId, basePayload)
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.snackbar.open(`Anunț publicat în ${courseIds.length} cursuri!`, undefined, { duration: 4000 });
        this.showComposer.set(false);
        this.resetComposer();
        this.isPosting.set(false);
        this.loadCourses(); // Refresh list
      },
      error: () => {
        this.snackbar.open('Nu am putut publica anunțul în toate cursurile', undefined, { duration: 4000 });
        this.isPosting.set(false);
      }
    });
  }

  trackById(_: number, a: AnnouncementWithCourse): string { return a.id; }

  imageUrl(a: AnnouncementWithCourse, attId: string): string {
    return this.api.getCoachImageUrl(a.courseId, a.id, attId);
  }

  videoUrl(a: AnnouncementWithCourse, attId: string): string {
    return this.api.getCoachVideoUrl(a.courseId, a.id, attId);
  }
}
