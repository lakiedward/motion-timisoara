# Soluție pentru eroarea 401 la ștergerea cursurilor

## TL;DR - Soluție rapidă
**Cel mai probabil token-ul tău JWT a expirat. Re-loghează-te!**

```
1. Click pe Logout în aplicație
2. Login din nou cu credențialele tale de admin
3. Încearcă să ștergi cursul din nou
```

## De ce se întâmplă asta?

Token-ul JWT expiră după **120 de minute (2 ore)** (configurabil în `application.yml`).

Când încerci să faci o acțiune (cum ar fi DELETE course) după ce token-ul a expirat:
- Frontend-ul trimite request-ul cu token-ul expirat
- Backend-ul detectează că token-ul nu mai este valid
- Returnează 401 Unauthorized

## Cum verifici dacă token-ul tău a expirat

### Metoda 1: Verifică în browser

1. Deschide Developer Tools (F12)
2. Console tab
3. Scrie:
```javascript
const token = localStorage.getItem('access_token');
if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = new Date(payload.exp * 1000);
    const now = new Date();
    console.log('Token expiră la:', exp);
    console.log('Acum este:', now);
    console.log('Token a expirat:', exp < now);
    console.log('Rol:', payload.role);
} else {
    console.log('Nu există token!');
}
```

### Metoda 2: Folosește jwt.io

1. Deschide Console (F12)
2. Scrie: `console.log(localStorage.getItem('access_token'))`
3. Copiază token-ul afișat
4. Mergi pe https://jwt.io
5. Lipește token-ul în secțiunea "Encoded"
6. Verifică payload-ul decodat:
   - `exp`: timestamp-ul când expiră (în secunde de la 1970)
   - `role`: ar trebui să fie "ADMIN"

## Cum testezi că autentificarea funcționează

Am adăugat un endpoint de debug în backend. După ce compilezi backend-ul:

### Test 1: Verifică starea autentificării
```bash
curl -H "Authorization: Bearer <TOKEN_TAU>" \
  https://triathlonteambe-production.up.railway.app/api/debug/auth-status
```

Ar trebui să vezi:
```json
{
  "isAuthenticated": true,
  "principal": {
    "userId": "...",
    "email": "admin@example.com",
    "role": "ADMIN",
    "authorities": ["ROLE_ADMIN"]
  }
}
```

### Test 2: Verifică headers
```bash
curl -H "Authorization: Bearer <TOKEN_TAU>" \
  https://triathlonteambe-production.up.railway.app/api/debug/headers
```

Ar trebui să vezi că `hasAuthorizationHeader` este `true`.

## Compilare și deploy backend cu noul debug controller

### Local
```bash
cd TriathlonTeamBE
./gradlew.bat bootRun
```

### Railway (production)
```bash
git add .
git commit -m "Add debug controller for auth troubleshooting"
git push origin main
```

Railway va detecta commit-ul și va face deploy automat.

## Dacă problema persistă după re-login

### 1. Verifică că token-ul este trimis

Deschide Network tab în Developer Tools și caută request-ul DELETE:
- Ar trebui să existe header-ul: `Authorization: Bearer eyJ...`
- Dacă lipsește, există o problemă cu `AuthInterceptor`

### 2. Verifică URL-ul request-ului

În Network tab, verifică URL-ul complet:
- Production: `https://triathlonteambe-production.up.railway.app/api/admin/courses/{id}`
- Local: `http://localhost:8081/api/admin/courses/{id}`

### 3. Verifică CORS

Dacă lucrezi local și backend-ul este pe Railway:
- Asigură-te că `src/index.html` are meta tag-ul:
  ```html
  <meta name="api-base-url" content="https://triathlonteambe-production.up.railway.app">
  ```

Dacă lucrezi local și backend-ul este local:
- Schimbă meta tag-ul în:
  ```html
  <meta name="api-base-url" content="http://localhost:8081">
  ```

### 4. Verifică configurația JWT în Railway

Pe Railway dashboard, verifică că există variabilele:
- `JWT_SECRET`: un secret lung și complex
- `JWT_EXPIRATION_MINUTES`: 120 (sau mai mult dacă vrei)

### 5. Verifică logurile backend-ului

#### Pe Railway:
1. Mergi pe railway.app
2. Selectează proiectul TriathlonTeamBE
3. Click pe "View Logs"
4. Caută linii cu:
   - `✓ Successfully authenticated user:`
   - `✗ Token validation failed`
   - `No token found in request`

#### Local:
```bash
cd TriathlonTeamBE
type logs\triathlon-app.log | findstr /i "auth token jwt"
```

## Debugging avansat

Dacă vrei să vezi loguri mai detaliate în backend, modifică în `application.yml`:

```yaml
logging:
  level:
    com.club.triathlon.security: DEBUG
    org.springframework.security: DEBUG
```

Apoi rebuild și restart backend-ul.

## Creșterea duratei de viață a token-ului

Dacă vrei ca token-urile să dureze mai mult (de exemplu 24 ore):

### Local
În `application.yml`:
```yaml
app:
  jwt:
    expiration-minutes: 1440  # 24 ore
```

### Railway
Setează environment variable:
```
JWT_EXPIRATION_MINUTES=1440
```

**ATENȚIE:** Token-uri cu durată mare de viață pot fi un risc de securitate. Pentru production, 120 minute (2 ore) este rezonabil.

## Rezumat

1. ✅ **Soluția cea mai probabilă:** Re-loghează-te
2. ✅ **Verifică:** Token-ul nu a expirat (folosește scriptul din Console)
3. ✅ **Testează:** Folosește fișierul `test-delete-course.html`
4. ✅ **Debug:** Folosește `/api/debug/auth-status` după ce compilezi backend-ul
5. ✅ **Verifică:** Network tab - Authorization header este trimis

Dacă după toate acestea problema persistă, anunță-mă cu detalii despre:
- Ce vezi în Network tab (screenshot)
- Ce vezi în Console (screenshot)
- Rezultatul de la `/api/debug/auth-status`



