import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-video-embed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-embed.component.html',
  styleUrls: ['./video-embed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoEmbedComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() url: string = '';

  readonly kind = computed<'iframe' | 'video' | 'link'>(() => {
    const u = (this.url || '').trim();
    if (!u) return 'link';
    if (this.isYouTube(u) || this.isVimeo(u) || this.isDrive(u)) return 'iframe';
    if (u.endsWith('.mp4')) return 'video';
    return 'link';
  });

  readonly safeSrc = computed<SafeResourceUrl | null>(() => {
    const u = (this.url || '').trim();
    if (!u) return null;
    if (this.isYouTube(u)) return this.sanitizer.bypassSecurityTrustResourceUrl(this.youtubeEmbed(u));
    if (this.isVimeo(u)) return this.sanitizer.bypassSecurityTrustResourceUrl(this.vimeoEmbed(u));
    if (this.isDrive(u)) return this.sanitizer.bypassSecurityTrustResourceUrl(this.driveEmbed(u));
    return null;
  });

  private isYouTube(u: string): boolean {
    return /youtu\.be\//.test(u) || /youtube\.com\/watch\?v=/.test(u) || /youtube\.com\/shorts\//.test(u);
  }
  private isVimeo(u: string): boolean {
    return /vimeo\.com\//.test(u);
  }
  private isDrive(u: string): boolean {
    return /drive\.google\.com\/file\//.test(u);
  }

  private youtubeEmbed(u: string): string {
    // Support watch?v=, youtu.be/, shorts/
    let id = '';
    const watch = u.match(/[?&]v=([^&]+)/);
    if (watch) id = watch[1];
    if (!id) {
      const short = u.match(/youtu\.be\/([^?]+)/);
      if (short) id = short[1];
    }
    if (!id) {
      const shorts = u.match(/youtube\.com\/shorts\/([^?]+)/);
      if (shorts) id = shorts[1];
    }
    return `https://www.youtube.com/embed/${id}`;
  }

  private vimeoEmbed(u: string): string {
    const m = u.match(/vimeo\.com\/(\d+)/);
    const id = m ? m[1] : '';
    return `https://player.vimeo.com/video/${id}`;
  }

  private driveEmbed(u: string): string {
    const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const id = m ? m[1] : '';
    return `https://drive.google.com/file/d/${id}/preview`;
  }
}
