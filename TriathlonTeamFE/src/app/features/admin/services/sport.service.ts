import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Sport, CreateSportRequest, UpdateSportRequest } from './models/sport.model';

@Injectable({
  providedIn: 'root'
})
export class SportService {
  private readonly supabase = inject(SupabaseService);

  getSports(): Observable<Sport[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('sports')
          .select('id, code, name');
        if (error) throw error;
        return (data ?? []) as Sport[];
      })()
    );
  }

  createSport(request: CreateSportRequest): Observable<Sport> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('sports')
          .insert({ code: request.code, name: request.name })
          .select('id, code, name')
          .single();
        if (error) throw error;
        return data as Sport;
      })()
    );
  }

  updateSport(id: string, request: UpdateSportRequest): Observable<Sport> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('sports')
          .update({ code: request.code, name: request.name })
          .eq('id', id)
          .select('id, code, name')
          .single();
        if (error) throw error;
        return data as Sport;
      })()
    );
  }

  deleteSport(id: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('sports')
          .delete()
          .eq('id', id);
        if (error) throw error;
      })()
    );
  }
}
