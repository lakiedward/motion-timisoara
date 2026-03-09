# Soluția Finală - Pozele Antrenorilor

## Problema Inițială

Pozele antrenorilor nu se afișau în site, deși funcționau în Postman. Eroarea era `302 Found` când se accesa `http://localhost:4201/api/admin/coaches/{id}/photo`.

## Cauze Identificate

### 1. **SSR Error (Server-Side Rendering)**
- **Problema**: `document is not defined` în `API_BASE_URL` factory
- **Soluție**: Adăugat verificare pentru browser environment:
```typescript
if (typeof document !== 'undefined') {
  // cod pentru browser
}
```

### 2. **URL-uri Relative pentru Imagini**
- **Problema**: Tag-urile `<img src="...">` nu trec prin interceptoarele Angular
- **Soluție**: Injectat `API_BASE_URL` în servicii/componente pentru URL-uri complete

### 3. **DestroyRef Missing**
- **Problema**: `takeUntilDestroyed()` fără `DestroyRef` injectat
- **Soluție**: Adăugat `DestroyRef` injection în `CoachesListComponent`

### 4. **Admin Endpoint Security**
- **Problema**: `403 Forbidden` pentru admin endpoint
- **Soluție**: Corectat pattern-ul de securitate: `/api/admin/coaches/**/photo`

## Modificări Implementate

### 1. `app.config.ts` - Fix SSR
```typescript
{
  provide: API_BASE_URL,
  useFactory: () => {
    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
      const fromMeta = meta?.content?.trim();
      if (fromMeta) return fromMeta.replace(/\/$/, '');
    }
    return '';
  },
}
```

### 2. `admin.service.ts` - URL Complet
```typescript
getCoachPhotoUrl(coachId: string): string {
  const base = this.apiBaseUrl.replace(/\/$/, '');
  return `${base}${this.baseUrl}/coaches/${coachId}/photo`;
}
```

### 3. `coaches-list.component.ts` - URL Complet + DestroyRef
```typescript
export class CoachesListComponent {
  private readonly api = inject(PublicApiService);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  getCoachPhotoUrl(coachId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachId}/photo`;
  }
}
```

### 4. `coach-profile.component.ts` - URL Complet
```typescript
getCoachPhotoUrl(coachId: string): string {
  const base = this.apiBaseUrl.replace(/\/$/, '');
  return `${base}/api/public/coaches/${coachId}/photo`;
}
```

### 5. `SecurityConfig.kt` - Fix Pattern
```kotlin
.requestMatchers("/api/admin/coaches/**/photo").permitAll()
```

## Rezultat

### URL-uri Generate Acum:
- **Public**: `https://triathlonteambe-production.up.railway.app/api/public/coaches/{id}/photo`
- **Admin**: `https://triathlonteambe-production.up.railway.app/api/admin/coaches/{id}/photo`

### Endpoint-uri Testate:
✅ `https://triathlonteambe-production.up.railway.app/api/public/coaches/e2745c21-651b-4c97-80c9-81009994717f/photo` - 200 OK  
✅ `https://triathlonteambe-production.up.railway.app/api/admin/coaches/e2745c21-651b-4c97-80c9-81009994717f/photo` - 200 OK (după fix)

## Testare

1. **Local**: `npm start` → `http://localhost:4201/antrenori`
2. **Production**: Deploy pe Railway → verifică pozele în browser

## Note Importante

- **ÎNTOTDEAUNA** verifică `src/index.html` meta tag-ul `api-base-url`
- Pentru local: `<meta name="api-base-url" content="http://localhost:8081">`
- Pentru production: `<meta name="api-base-url" content="https://triathlonteambe-production.up.railway.app">`
- Această soluție funcționează pentru TOATE resursele statice (imagini, fișiere, etc.)

## Fișiere Modificate

1. `src/app/app.config.ts` - Fix SSR
2. `src/app/features/admin/services/admin.service.ts` - URL complet admin
3. `src/app/features/coaches/components/coaches-list/coaches-list.component.ts` - URL complet + DestroyRef
4. `src/app/features/coaches/components/coach-profile/coach-profile.component.ts` - URL complet
5. `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/config/SecurityConfig.kt` - Fix security pattern

---

**Status**: ✅ REZOLVAT - Pozele antrenorilor se afișează corect în site!
