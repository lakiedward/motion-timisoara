# Soluție pentru eroarea 403 (Română)

## Ce am făcut

Am adăugat **logging foarte detaliat** pentru a identifica exact de ce primești 403 chiar dacă ai rol de ADMIN în baza de date.

## Modificări importante

### 1. UserPrincipal - FIX CRITIC! ✅
**Problema găsită:** `isEnabled()` returna întotdeauna `true` indiferent de valoarea din baza de date!

```kotlin
// ÎNAINTE (GREȘIT):
override fun isEnabled(): Boolean = true

// ACUM (CORECT):
override fun isEnabled(): Boolean = user.enabled
```

**Verifică în baza de date:**
```sql
SELECT email, role, enabled FROM users WHERE email = 'admin@test.com';
```

Dacă `enabled = false`, acesta ar putea fi motivul! Ar trebui să fie `enabled = true`.

### 2. Logging detaliat în toate locurile critice

**JwtAuthenticationFilter** - Loghează:
- Username-ul extras din token
- Autoritățile utilizatorului (ar trebui să fie `[ROLE_ADMIN]`)
- Dacă utilizatorul este enabled
- Dacă validarea token-ului a reușit

**UserPrincipal** - Loghează:
- Rolul utilizatorului la crearea principal-ului
- Autoritatea creată (ar trebui să fie `ROLE_ADMIN`)
- Starea enabled

**CustomAccessDeniedHandler** - Loghează:
- Toate detaliile autentificării când se întâmplă 403
- Autoritățile efective pe care le are utilizatorul
- Principal-ul (UserPrincipal)

### 3. Răspuns JSON îmbunătățit pentru 403

Acum vei primi și autoritățile în răspuns:
```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied: You don't have permission to access this resource",
  "path": "/api/admin/coaches/invite",
  "timestamp": "2025-10-08T08:27:54.280920234Z",
  "authenticated": true,
  "authorities": ["ROLE_ADMIN"]
}
```

**Verifică field-ul `authorities`!** Dacă este gol `[]` sau nu conține `"ROLE_ADMIN"`, asta e problema!

## Pași pentru debugging

### 1. Deploy pe Railway

```powershell
git add .
git commit -m "Add detailed logging for 403 debugging + fix UserPrincipal.isEnabled"
git push
```

Așteaptă ~2-3 minute pentru deployment.

### 2. Fă request-ul din nou

Acum răspunsul va include `authorities`:

```bash
POST https://triathlonteambe-production.up.railway.app/api/admin/coaches/invite
Authorization: Bearer YOUR_TOKEN
```

### 3. Verifică răspunsul JSON

**Cazul 1: `authorities` este gol `[]`**
```json
{
  "authenticated": true,
  "authorities": []
}
```
➜ Problema: Rolul nu e setat corect în UserPrincipal sau în baza de date

**Cazul 2: `authorities` conține alt rol**
```json
{
  "authenticated": true,
  "authorities": ["ROLE_PARENT"]
}
```
➜ Problema: Utilizatorul are rol greșit în DB. Rulează:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@test.com';
```

**Cazul 3: `authenticated` este `false`**
```json
{
  "authenticated": false,
  "authorities": []
}
```
➜ Problema: Token-ul nu e valid sau a expirat. Fă login din nou.

### 4. Verifică log-urile din Railway

Railway Dashboard → TriathlonTeamBE → Deployments → View Logs

Caută după:

**✓ Autentificare reușită:**
```
INFO  c.c.t.s.JwtAuthenticationFilter - Loaded user details for: admin@test.com
INFO  c.c.t.s.JwtAuthenticationFilter - User authorities: [ROLE_ADMIN]
INFO  c.c.t.s.JwtAuthenticationFilter - User enabled: true
INFO  c.c.t.s.JwtAuthenticationFilter - ✓ Successfully authenticated user: admin@test.com
```

**✗ 403 Access Denied:**
```
ERROR c.c.t.s.CustomAccessDeniedHandler - ⚠️ ACCESS DENIED to POST /api/admin/coaches/invite
ERROR c.c.t.s.CustomAccessDeniedHandler - Authentication present: true
ERROR c.c.t.s.CustomAccessDeniedHandler - Principal: com.club.triathlon.security.UserPrincipal@xxxxx
ERROR c.c.t.s.CustomAccessDeniedHandler - Authorities: [ROLE_ADMIN]
ERROR c.c.t.s.CustomAccessDeniedHandler - Is authenticated: true
```

## Cauze posibile și soluții

### Cauza 1: `enabled = false` în baza de date
**Verificare:**
```sql
SELECT email, role, enabled FROM users WHERE email = 'admin@test.com';
```

**Soluție:**
```sql
UPDATE users SET enabled = true WHERE email = 'admin@test.com';
```

### Cauza 2: Rolul nu e `ADMIN`
**Verificare:**
```sql
SELECT email, role FROM users WHERE email = 'admin@test.com';
-- Ar trebui să fie: role = 'ADMIN' (nu 'PARENT' sau 'COACH')
```

**Soluție:**
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@test.com';
```

### Cauza 3: Token expirat
Decodează token-ul la https://jwt.io și verifică:
```json
{
  "exp": 1759918663  // Trebuie să fie în viitor!
}
```

**Soluție:** Login din nou:
```bash
POST https://triathlonteambe-production.up.railway.app/api/auth/login
{
  "email": "admin@test.com",
  "password": "parola-ta"
}
```

### Cauza 4: Utilizatorul nu există în production
Verifică dacă există:
```sql
SELECT COUNT(*) FROM users WHERE email = 'admin@test.com';
```

**Soluție:** Creează utilizatorul:
1. Folosește endpoint-ul de register
2. Apoi updatează rolul la ADMIN

### Cauza 5: Multiple conturi cu același email (mai puțin probabil)
```sql
SELECT id, email, role, enabled, created_at 
FROM users 
WHERE email = 'admin@test.com';
```

Dacă sunt multiple, șterge duplicatele și păstrează unul singur cu `role = 'ADMIN'` și `enabled = true`.

## Test local înainte de deploy

Testează local pentru a identifica problema mai rapid:

```powershell
# Terminal 1: Pornește backend-ul
cd TriathlonTeamBE
.\gradlew.bat bootRun

# Terminal 2: Verifică log-urile în consolă
# Vei vedea toate mesajele de logging în timp real
```

Apoi fă request-ul către `http://localhost:8081/api/admin/coaches/invite` și urmărește log-urile din consolă.

## Ce să cauți în log-uri

### LOG BUNE (totul funcționează):
```
DEBUG c.c.t.s.UserPrincipal - Creating UserPrincipal for user: admin@test.com, role: ADMIN, enabled: true
DEBUG c.c.t.s.UserPrincipal - Authority created: ROLE_ADMIN
INFO  c.c.t.s.JwtAuthenticationFilter - User authorities: [ROLE_ADMIN]
INFO  c.c.t.s.JwtAuthenticationFilter - User enabled: true
INFO  c.c.t.s.JwtAuthenticationFilter - ✓ Successfully authenticated user: admin@test.com
```

### LOG RELE (probleme):

**Problema: enabled = false**
```
DEBUG c.c.t.s.UserPrincipal - Creating UserPrincipal for user: admin@test.com, role: ADMIN, enabled: false
INFO  c.c.t.s.JwtAuthenticationFilter - User enabled: false
```

**Problema: rol greșit**
```
DEBUG c.c.t.s.UserPrincipal - Creating UserPrincipal for user: admin@test.com, role: PARENT, enabled: true
DEBUG c.c.t.s.UserPrincipal - Authority created: ROLE_PARENT
```

**Problema: token invalid**
```
WARN  c.c.t.s.JwtAuthenticationFilter - ✗ Token validation failed for user: admin@test.com
```

**Problema: utilizator nu există**
```
ERROR c.c.t.s.JwtAuthenticationFilter - ✗ Error loading user details for username: admin@test.com
org.springframework.security.core.userdetails.UsernameNotFoundException: User with email admin@test.com not found
```

## Următorii pași

1. **Deploy pe Railway** - Push modificările
2. **Fă request-ul din nou** - Verifică field-ul `authorities` în răspuns
3. **Verifică log-urile** - Caută mesajele cu ✓ sau ✗
4. **Verifică baza de date** - Confirmă `role = 'ADMIN'` și `enabled = true`
5. **Raportează rezultatul** - Cu authorities din răspuns și log-urile relevante

## Fișiere modificate

- `CustomAccessDeniedHandler.kt` - Adaugă authorities în răspunsul JSON + logging detaliat
- `JwtAuthenticationFilter.kt` - Logging detaliat pentru autentificare
- `UserPrincipal.kt` - **FIX CRITIC:** `isEnabled()` acum folosește `user.enabled` din DB + logging
- `SecurityConfig.kt` - Folosește custom handlers (deja făcut anterior)

---

**Dacă problema persistă după aceste modificări, următorul debug va arăta EXACT unde e problema în log-uri!** 🔍


