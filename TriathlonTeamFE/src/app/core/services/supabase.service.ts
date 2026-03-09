import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../tokens/supabase.token';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(
    @Inject(SUPABASE_URL) private supabaseUrl: string,
    @Inject(SUPABASE_ANON_KEY) private supabaseAnonKey: string,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    // Use a dummy key during SSR route extraction when real credentials aren't available
    const url = this.supabaseUrl || 'https://placeholder.supabase.co';
    const key = this.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';
    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: isPlatformBrowser(this.platformId),
        detectSessionInUrl: isPlatformBrowser(this.platformId),
      },
    });
  }

  get auth() {
    return this.client.auth;
  }

  from(table: string) {
    return this.client.from(table);
  }

  storage(bucket: string) {
    return this.client.storage.from(bucket);
  }

  channel(name: string) {
    return this.client.channel(name);
  }

  removeChannel(channel: any) {
    return this.client.removeChannel(channel);
  }

  async invokeFunction<T = any>(name: string, body?: any): Promise<T> {
    const { data, error } = await this.client.functions.invoke(name, {
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    });
    if (error) throw error;
    return data as T;
  }
}
