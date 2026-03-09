import { InjectionToken } from '@angular/core';

/**
 * Provides the absolute base URL of the backend without trailing slash.
 * Example: https://triathlonteambe-production.up.railway.app
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');


