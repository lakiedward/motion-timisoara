import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface Child {
  id: string;
  name: string;
  birthDate: string;
  level?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyPhone: string;
  gdprConsentAt?: string;
  secondaryContactName?: string;
  secondaryPhone?: string;
  tshirtSize?: string;
  hasPhoto?: boolean;
}

export interface ChildPayload {
  name: string;
  birthDate: string;
  level?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyPhone: string;
  secondaryContactName?: string;
  secondaryPhone?: string;
  tshirtSize?: string;
}

export interface ScheduleConflict {
  conflictingCourseId: string;
  conflictingCourseName: string;
  dayOfWeek: string;
  timeRange: string;
}

export interface ChildValidationResult {
  childId: string;
  childName: string;
  isValid: boolean;
  ageValid: boolean;
  ageMessage: string | null;
  scheduleConflicts: ScheduleConflict[];
}

@Injectable({ providedIn: 'root' })
export class ChildrenService {
  private readonly supabase = inject(SupabaseService);

  private readonly childPhotoBust = new Map<string, number>();

  private readonly childrenSubject = new BehaviorSubject<Child[]>([]);
  readonly children$ = this.childrenSubject.asObservable();

  loadChildren(): Observable<Child[]> {
    return from(this.fetchChildren()).pipe(
      tap((children) => this.childrenSubject.next(children)),
      catchError((error) => {
        console.warn('Folosesc date mock pentru copii', error);
        const fallback = this.mockChildren();
        this.childrenSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  getChild(id: string): Observable<Child> {
    const cached = this.childrenSubject.value.find((child) => child.id === id);
    if (cached) {
      return of(cached);
    }
    return from(this.fetchChild(id));
  }

  getChildPhotoUrl(id: string): string {
    // Generate a Supabase Storage public/signed URL for the child photo
    const path = `children/${id}/photo`;
    const { data } = this.supabase.storage('child-photos').getPublicUrl(path);
    const url = data?.publicUrl ?? '';
    const bust = this.childPhotoBust.get(id);
    if (!bust) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${bust}`;
  }

  uploadChildPhoto(id: string, base64: string): Observable<void> {
    return from(this.uploadPhoto(id, base64)).pipe(
      tap(() => {
        this.childPhotoBust.set(id, Date.now());
        this.childrenSubject.next(
          this.childrenSubject.value.map((child) =>
            child.id === id ? { ...child, hasPhoto: true } : child
          )
        );
      })
    );
  }

  createChild(payload: ChildPayload): Observable<Child> {
    return from(this.insertChild(payload)).pipe(
      tap((child) => this.childrenSubject.next([...this.childrenSubject.value, child]))
    );
  }

  updateChild(id: string, payload: ChildPayload): Observable<Child> {
    return from(this.updateChildRow(id, payload)).pipe(
      tap((child) => {
        this.childrenSubject.next(
          this.childrenSubject.value.map((existing) => (existing.id === id ? child : existing))
        );
      })
    );
  }

  deleteChild(id: string): Observable<void> {
    return from(this.deleteChildRow(id)).pipe(
      tap(() =>
        this.childrenSubject.next(this.childrenSubject.value.filter((child) => child.id !== id))
      )
    );
  }

  saveChild(id: string | null, payload: ChildPayload): Observable<Child> {
    return id ? this.updateChild(id, payload) : this.createChild(payload);
  }

  validateChildren(courseId: string, childIds: string[]): Observable<ChildValidationResult[]> {
    return from(
      this.supabase.invokeFunction<ChildValidationResult[]>('validate-enrollment', {
        courseId,
        childIds
      })
    );
  }

  // --- Private Supabase operations ---

  private async fetchChildren(): Promise<Child[]> {
    // RLS filters by parent_id automatically
    const { data, error } = await this.supabase
      .from('children')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => this.mapChildRow(row));
  }

  private async fetchChild(id: string): Promise<Child> {
    const { data, error } = await this.supabase
      .from('children')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return this.mapChildRow(data);
  }

  private async insertChild(payload: ChildPayload): Promise<Child> {
    const [firstName, ...lastParts] = payload.name.split(' ');
    const lastName = lastParts.join(' ') || '';

    const { data, error } = await this.supabase
      .from('children')
      .insert({
        first_name: firstName,
        last_name: lastName,
        birth_date: payload.birthDate,
        notes: payload.allergies ?? null
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapChildRow(data);
  }

  private async updateChildRow(id: string, payload: ChildPayload): Promise<Child> {
    const [firstName, ...lastParts] = payload.name.split(' ');
    const lastName = lastParts.join(' ') || '';

    const { data, error } = await this.supabase
      .from('children')
      .update({
        first_name: firstName,
        last_name: lastName,
        birth_date: payload.birthDate,
        notes: payload.allergies ?? null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapChildRow(data);
  }

  private async deleteChildRow(id: string): Promise<void> {
    const { error } = await this.supabase.from('children').delete().eq('id', id);

    if (error) throw error;
  }

  private async uploadPhoto(id: string, base64: string): Promise<void> {
    // Convert base64 to Uint8Array for storage upload
    const byteString = atob(base64.replace(/^data:image\/\w+;base64,/, ''));
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    const path = `children/${id}/photo`;
    const { error } = await this.supabase.storage('child-photos').upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: true
    });

    if (error) throw error;

    // Update the child record to indicate a photo exists
    await this.supabase
      .from('children')
      .update({ photo_storage_path: path })
      .eq('id', id);
  }

  private mapChildRow(row: any): Child {
    if (!row || !row.id) {
      console.warn('Child response missing id', row);
      throw new Error('Child response missing id');
    }

    const firstName = row.first_name ?? '';
    const lastName = row.last_name ?? '';
    const name = `${firstName} ${lastName}`.trim();

    return {
      id: String(row.id),
      name,
      birthDate: row.birth_date ?? '',
      level: undefined,
      allergies: row.notes ?? undefined,
      emergencyContactName: undefined,
      emergencyPhone: '',
      gdprConsentAt: undefined,
      secondaryContactName: undefined,
      secondaryPhone: undefined,
      tshirtSize: undefined,
      hasPhoto: Boolean(row.photo_storage_path)
    };
  }

  private mockChildren(): Child[] {
    return [
      {
        id: 'child-1',
        name: 'Andrei Pop',
        birthDate: '2012-05-14',
        allergies: 'Alune',
        emergencyContactName: 'Mama - Irina',
        emergencyPhone: '+40733333111'
      },
      {
        id: 'child-2',
        name: 'Maria Pop',
        birthDate: '2015-09-02',
        allergies: '',
        emergencyContactName: 'Tata - Mihai',
        emergencyPhone: '+40733333222'
      }
    ];
  }
}
