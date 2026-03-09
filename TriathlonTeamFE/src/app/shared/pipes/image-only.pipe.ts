import { Pipe, PipeTransform } from '@angular/core';
import { AnnouncementAttachment } from '../../core/services/announcements.service';

@Pipe({ name: 'imageOnly', standalone: true })
export class ImageOnlyPipe implements PipeTransform {
  transform(value: AnnouncementAttachment[] | null | undefined): AnnouncementAttachment[] {
    if (!value) return [];
    return value.filter((a) => a.type === 'IMAGE' && a.image);
  }
}
