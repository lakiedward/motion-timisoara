import { Pipe, PipeTransform } from '@angular/core';
import { AnnouncementAttachment } from '../../core/services/announcements.service';

@Pipe({ name: 'videoOnly', standalone: true })
export class VideoOnlyPipe implements PipeTransform {
  transform(value: AnnouncementAttachment[] | null | undefined): AnnouncementAttachment[] {
    if (!value) return [];
    return value.filter((a) =>
      (a.type === 'VIDEO_LINK' && !!a.url) || a.type === 'VIDEO_FILE'
    );
  }
}
