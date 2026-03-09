# Coach Photo URL Fix - Soluție

## Problema

Pozele antrenorilor **funcționau în Postman** dar **nu se încărcau în site**. Browser-ul primea un **302 redirect** când încerca să acceseze URL-urile de tipul:
- `http://localhost:4201/api/admin/coaches/{id}/photo` → 302 redirect
- `http://localhost:4201/api/public/coaches/{id}/photo` → 302 redirect

## Cauza

Imaginile încărcate prin tag-ul HTML `<img src="...">` sunt **request-uri native ale browser-ului** și **NU trec prin interceptoarele Angular** (cum este `BaseUrlInterceptor`).

### Cum funcționa înainte (GREȘIT):

```typescript
// admin.service.ts
getCoachPhotoUrl(coachId: string): string {
  return `/api/admin/coaches/${coachId}/photo`;  // URL relativ
}

// coaches-list.component.ts
getCoachPhotoUrl(coachId: string): string {
  return `/api/public/coaches/${coachId}/photo`;  // URL relativ
}
```

**Rezultat:** Browser-ul încerca să încarce imaginea de la Angular dev server (port 4201) în loc de backend (port 8081 sau Railway production).

### De ce interceptoarele nu funcționează pentru `<img>`?

- `BaseUrlInterceptor` funcționează **DOAR** pentru request-uri făcute prin `HttpClient`
- Request-urile native ale browser-ului (imagini, scripturi, CSS) **nu sunt interceptate**
- Browser-ul construiește URL-ul complet bazându-se pe URL-ul curent al paginii

## Soluția

Injectăm `API_BASE_URL` token în servicii/componente și construim URL-ul **complet** pentru imagini:

### 1. AdminService

```typescript
import { API_BASE_URL } from '../../../core/tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);  // ← Nou
  private readonly baseUrl = '/api/admin';

  getCoachPhotoUrl(coachId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}${this.baseUrl}/coaches/${coachId}/photo`;
  }
}
```

### 2. CoachesListComponent (Public)

```typescript
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

export class CoachesListComponent {
  private readonly api = inject(PublicApiService);
  private readonly apiBaseUrl = inject(API_BASE_URL);  // ← Nou

  getCoachPhotoUrl(coachId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachId}/photo`;
  }
}
```

### 3. CoachProfileComponent (Public)

```typescript
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';

export class CoachProfileComponent {
  private readonly api = inject(PublicApiService);
  private readonly apiBaseUrl = inject(API_BASE_URL);  // ← Nou

  getCoachPhotoUrl(coachId: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    return `${base}/api/public/coaches/${coachId}/photo`;
  }
}
```

## Rezultat

Acum URL-urile generate sunt **complete** și pointează direct către backend:

### Local (când `index.html` are `meta api-base-url` setat la `http://localhost:8081`):
```
http://localhost:8081/api/public/coaches/{id}/photo
http://localhost:8081/api/admin/coaches/{id}/photo
```

### Production (când `index.html` are `meta api-base-url` setat la Railway):
```
https://triathlonteambe-production.up.railway.app/api/public/coaches/{id}/photo
https://triathlonteambe-production.up.railway.app/api/admin/coaches/{id}/photo
```

## Fișiere modificate

1. `src/app/features/admin/services/admin.service.ts`
   - Adăugat import pentru `API_BASE_URL`
   - Injectat `apiBaseUrl` token
   - Modificat `getCoachPhotoUrl()` să returneze URL complet

2. `src/app/features/coaches/components/coaches-list/coaches-list.component.ts`
   - Adăugat import pentru `API_BASE_URL`
   - Injectat `apiBaseUrl` token
   - Modificat `getCoachPhotoUrl()` să returneze URL complet

3. `src/app/features/coaches/components/coach-profile/coach-profile.component.ts`
   - Adăugat import pentru `API_BASE_URL`
   - Injectat `apiBaseUrl` token
   - Modificat `getCoachPhotoUrl()` să returneze URL complet

## Testing

### Testare locală:
1. Asigură-te că `src/index.html` are meta tag-ul setat pentru local:
   ```html
   <meta name="api-base-url" content="http://localhost:8081">
   ```
2. Pornește backend-ul: `cd TriathlonTeamBE && gradlew bootRun`
3. Pornește frontend-ul: `cd TriathlonTeamFE && npm start`
4. Accesează: `http://localhost:4201/antrenori`
5. Verifică în Developer Tools → Network că imaginile se încarcă de la `http://localhost:8081/api/public/coaches/{id}/photo`

### Testare production:
1. Asigură-te că `src/index.html` are meta tag-ul setat pentru production:
   ```html
   <meta name="api-base-url" content="https://triathlonteambe-production.up.railway.app">
   ```
2. Deploy pe Railway
3. Accesează site-ul și verifică că imaginile se încarcă corect

## Note importante

- **ÎNTOTDEAUNA** verifică `src/index.html` meta tag-ul `api-base-url` înainte de deploy
- Pentru dezvoltare locală, setează-l la `http://localhost:8081`
- Pentru production, setează-l la URL-ul Railway
- Această soluție funcționează pentru TOATE resursele statice care nu pot folosi interceptoarele Angular

