import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AdminLocation, AdminLocationPayload } from './models/admin-location.model';

@Injectable({ providedIn: 'root' })
export class AdminLocationService {
  private readonly supabase = inject(SupabaseService);

  getAll(): Observable<AdminLocation[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('locations')
          .select('id, name, type, address, lat, lng');
        if (error) throw error;
        return (data ?? []).map((l: any) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          address: l.address ?? null,
          lat: l.lat ?? null,
          lng: l.lng ?? null,
        })) as AdminLocation[];
      })()
    );
  }

  getById(id: string): Observable<AdminLocation> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('locations')
          .select('id, name, type, address, lat, lng')
          .eq('id', id)
          .single();
        if (error) throw error;
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          address: data.address ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
        } as AdminLocation;
      })()
    );
  }

  create(payload: AdminLocationPayload): Observable<AdminLocation> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('locations')
          .insert({
            name: payload.name,
            type: payload.type,
            address: payload.address,
            lat: payload.lat,
            lng: payload.lng,
            active: true,
          })
          .select('id, name, type, address, lat, lng')
          .single();
        if (error) throw error;
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          address: data.address ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
        } as AdminLocation;
      })()
    );
  }

  update(id: string, payload: AdminLocationPayload): Observable<AdminLocation> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('locations')
          .update({
            name: payload.name,
            type: payload.type,
            address: payload.address,
            lat: payload.lat,
            lng: payload.lng,
          })
          .eq('id', id)
          .select('id, name, type, address, lat, lng')
          .single();
        if (error) throw error;
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          address: data.address ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
        } as AdminLocation;
      })()
    );
  }

  delete(id: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.supabase
          .from('locations')
          .delete()
          .eq('id', id);
        if (error) throw error;
      })()
    );
  }
}
