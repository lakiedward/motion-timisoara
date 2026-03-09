# Debug: Eroare 401 la ștergerea cursurilor

## Problema
Când încerci să ștergi un curs ca admin, primești:
```json
{
    "status": 401,
    "error": "Unauthorized",
    "message": "Authentication failed: Full authentication is required to access this resource",
    "path": "/error",
    "timestamp": "2025-10-09T10:57:20.833590775Z"
}
```

## Cauze posibile

### 1. Token-ul JWT a expirat
Token-ul JWT este setat să expire după un anumit timp (configurabil în backend via `app.jwt.expiration-minutes`).

**Verificare:**
1. Deschide Console (F12) în browser
2. Scrie: `localStorage.getItem('access_token')`
3. Copiază token-ul și decodifică-l pe https://jwt.io
4. Verifică câmpul `exp` (expiration) - dacă e în trecut, token-ul a expirat

**Soluție:** Re-loghează-te

### 2. Token-ul nu este trimis în request

**Verificare:**
1. Deschide Developer Tools (F12)
2. Mergi la tab-ul Network
3. Încearcă să ștergi un curs
4. Găsește request-ul DELETE către `/api/admin/courses/{id}`
5. Verifică Headers → Request Headers
6. Caută header-ul `Authorization: Bearer eyJ...`

**Soluție:** Dacă lipsește header-ul, există o problemă cu `AuthInterceptor`

### 3. URL-ul nu este corect

**Verificare:**
1. În Network tab, verifică URL-ul complet al request-ului DELETE
2. Ar trebui să fie ceva de genul:
   - Production: `https://triathlonteambe-production.up.railway.app/api/admin/courses/{uuid}`
   - Local: `http://localhost:8081/api/admin/courses/{uuid}`

### 4. Userul nu are rolul ADMIN

**Verificare:**
1. Deschide Console (F12)
2. Scrie: `localStorage.getItem('access_token')`
3. Decodifică token-ul pe https://jwt.io
4. Verifică că în payload există `"role": "ADMIN"`

## Cum să folosești fișierul de test

Am creat `test-delete-course.html` pentru debugging:

1. Deschide fișierul `test-delete-course.html` în browser
2. Token-ul se va încărca automat din localStorage (dacă există)
3. Introdu un Course ID valid (poți găsi unul făcând click pe "Test GET /api/admin/courses")
4. Click pe "Test DELETE /api/admin/courses/{id}"
5. Verifică rezultatul și Console-ul browser-ului

## Soluții rapide

### A. Verifică expirarea token-ului și re-loghează-te

Cea mai frecventă cauză este expirarea token-ului. Încearcă să te deloghezi și să te loghezi din nou.

### B. Verifică configurația backend-ului local

Dacă rulezi backend-ul local, asigură-te că:
```yaml
# TriathlonTeamBE/src/main/resources/application.yml
app:
  jwt:
    secret: "un-secret-foarte-lung-si-complex"
    expiration-minutes: 1440  # 24 ore
  cors:
    allowed-origins: "http://localhost:4201"
```

### C. Verifică meta tag-ul în frontend

În `TriathlonTeamFE/src/index.html`:
```html
<meta name="api-base-url" content="https://triathlonteambe-production.up.railway.app">
```

Pentru dev local, schimbă în:
```html
<meta name="api-base-url" content="http://localhost:8081">
```

## Debugging avansat

### Adaugă logging în AuthInterceptor

În browser console, când folosești app-ul, ar trebui să vezi loguri de la AuthInterceptor (doar în dev mode):
```
[AuthInterceptor] { url: '/api/admin/courses/...', addedAuthHeader: true, tokenPreview: 'eyJhbGci...' }
```

Dacă nu vezi aceste loguri, verifică că aplicația rulează în dev mode.

### Verifică logurile backend-ului

Dacă rulezi backend-ul local, verifică în `TriathlonTeamBE/logs/triathlon-app.log`:
```
✓ Successfully authenticated user: user@example.com with authorities: [ROLE_ADMIN]
```

Sau:
```
✗ Token validation failed for user: user@example.com
```

## Next Steps

1. **Încearcă mai întâi:** Deloghează-te și loghează-te din nou
2. **Dacă problema persistă:** Folosește `test-delete-course.html` pentru a verifica exact ce se întâmplă
3. **Verifică Network tab-ul:** Vezi dacă Authorization header-ul este trimis
4. **Verifică token-ul pe jwt.io:** Vezi dacă e expirat sau are rolul corect



