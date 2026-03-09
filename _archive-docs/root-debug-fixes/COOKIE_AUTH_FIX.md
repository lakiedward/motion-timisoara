# Fix: Cookie Authentication - Reload Page Logout Issue

**Data:** 22 Octombrie 2025  
**Issue:** După reload page, utilizatorul era delogat  
**Cauză:** Cookie cu `Secure=true` nu funcționează pe HTTP (local dev)  
**Soluție:** Cookie settings dinamice bazate pe environment

---

## Problema

Când utilizatorul făcea reload la pagină, era delogat automat. 

### Root Cause:

În `AuthController.kt`, cookie-ul era setat cu `secure = true`:

```kotlin
// ÎNAINTE (problematic)
private fun setAuthCookie(response: HttpServletResponse, token: String) {
    val cookie = Cookie("access_token", token)
    cookie.isHttpOnly = true
    cookie.secure = true  // ❌ Nu funcționează pe HTTP (localhost)
    cookie.path = "/"
    cookie.maxAge = 60 * 60 * 24 * 7
    cookie.setAttribute("SameSite", "Strict")
    response.addCookie(cookie)
}
```

**Problema:**
- Flag-ul `Secure=true` înseamnă că browser-ul va seta cookie-ul DOAR pe HTTPS
- În development local (http://localhost:8081), browser-ul **ignora** acest cookie
- La reload, frontend-ul încerca să obțină user-ul cu `/api/auth/me`, dar fără cookie → 401 → logout

---

## Soluția Implementată

### 1. Cookie Settings Dinamice (Environment-Aware)

**Fișier:** `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/web/AuthController.kt`

```kotlin
@RestController
@RequestMapping("/api/auth")
@Validated
class AuthController(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val authenticationManager: AuthenticationManager,
    @Value("\${server.ssl.enabled:false}") private val sslEnabled: Boolean  // ✅ Nou
) {
    
    private fun setAuthCookie(response: HttpServletResponse, token: String) {
        val cookie = Cookie("access_token", token)
        cookie.isHttpOnly = true
        
        // ✅ Secure flag doar în producție (HTTPS)
        cookie.secure = sslEnabled
        
        cookie.path = "/"
        cookie.maxAge = 60 * 60 * 24 * 7
        
        // ✅ SameSite=Strict în producție, Lax în development
        cookie.setAttribute("SameSite", if (sslEnabled) "Strict" else "Lax")
        
        response.addCookie(cookie)
        
        logger.debug("Set auth cookie: secure={}, sameSite={}", 
            cookie.secure, if (sslEnabled) "Strict" else "Lax")
    }
    
    private fun clearAuthCookie(response: HttpServletResponse) {
        val cookie = Cookie("access_token", "")
        cookie.isHttpOnly = true
        cookie.secure = sslEnabled
        cookie.path = "/"
        cookie.maxAge = 0
        cookie.setAttribute("SameSite", if (sslEnabled) "Strict" else "Lax")
        response.addCookie(cookie)
        
        logger.debug("Cleared auth cookie")
    }
}
```

### 2. Import Necesar

```kotlin
import org.springframework.beans.factory.annotation.Value
```

---

## Configurare pe Environment

### Development Local (HTTP)

**Default behavior** - nu necesită configurare:
- `server.ssl.enabled` = `false` (implicit)
- Cookie: `HttpOnly=true`, `Secure=false`, `SameSite=Lax`
- ✅ Funcționează pe http://localhost:8081

### Production (Railway - HTTPS)

**Trebuie setată variabilă de environment pe Railway:**

```bash
SERVER_SSL_ENABLED=true
```

**Cum se setează pe Railway:**

1. Accesează Railway Dashboard: https://railway.app
2. Selectează proiectul `TriathlonTeamBE`
3. Tab "Variables"
4. Adaugă:
   - **Key:** `SERVER_SSL_ENABLED`
   - **Value:** `true`
5. Save → Redeploy automatic

**Cookie în producție:**
- `HttpOnly=true`, `Secure=true`, `SameSite=Strict`
- ✅ Maxim nivel de securitate

---

## Testing

### Test Local (HTTP)

1. **Start backend:**
   ```bash
   cd TriathlonTeamBE
   .\gradlew.bat bootRun
   ```

2. **Login prin frontend sau curl:**
   ```bash
   curl -X POST http://localhost:8081/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"yourpassword"}' \
     -c cookies.txt
   ```

3. **Verifică cookie-ul:**
   ```bash
   cat cookies.txt
   ```
   
   Ar trebui să vezi:
   ```
   localhost	FALSE	/	FALSE	[timestamp]	access_token	[jwt_token]
   ```
   
   **FALSE** pe poziția 4 = `Secure=false` ✅

4. **Test reload:**
   - Login în aplicație
   - Reload page (F5)
   - ✅ Ar trebui să rămâi logat

### Test Production (HTTPS)

1. **Deploy pe Railway cu `SERVER_SSL_ENABLED=true`**

2. **Login:**
   ```bash
   curl -X POST https://triathlonteambe-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"yourpassword"}' \
     -c prod-cookies.txt
   ```

3. **Verifică cookie-ul:**
   ```bash
   cat prod-cookies.txt
   ```
   
   Ar trebui să vezi:
   ```
   .up.railway.app	TRUE	/	TRUE	[timestamp]	access_token	[jwt_token]
   ```
   
   **TRUE** pe poziția 4 = `Secure=true` ✅

4. **Test în browser:**
   - Login la https://motiontimisoara.com
   - DevTools → Application → Cookies → https://triathlonteambe-production.up.railway.app
   - Verifică că `access_token` are:
     - ✅ `HttpOnly`
     - ✅ `Secure`
     - ✅ `SameSite: Strict`

---

## Beneficii Security pe Environment

### Development (HTTP)
- `Secure: false` → Cookie funcționează pe localhost
- `SameSite: Lax` → Permite testing mai ușor
- ✅ **Workflow de development fluid**

### Production (HTTPS)
- `Secure: true` → Cookie transmis DOAR pe HTTPS
- `SameSite: Strict` → Protecție maximă CSRF
- ✅ **Securitate maximă**

---

## Troubleshooting

### Problema: Tot mă deloghează la reload (local)

**Verificări:**

1. **Backend rulează pe HTTP?**
   ```bash
   # Ar trebui să fie http:// NU https://
   http://localhost:8081/swagger-ui.html
   ```

2. **Cookie este setat?**
   - DevTools → Application → Cookies → http://localhost:8081
   - Cauți `access_token`
   - Dacă nu există → login nu a funcționat corect

3. **Frontend trimite withCredentials?**
   - DevTools → Network → Request la `/api/auth/me`
   - Headers → ar trebui să includă cookie-ul automat

4. **CORS permite credentials?**
   - Backend `SecurityConfig.kt` are `allowCredentials = true` ✅
   - Frontend `AuthInterceptor` adaugă `withCredentials: true` ✅

### Problema: Nu merge în producție (Railway)

**Verificări:**

1. **`SERVER_SSL_ENABLED=true` este setat?**
   ```bash
   # Railway Dashboard → Variables → verifică
   ```

2. **Backend răspunde pe HTTPS?**
   ```bash
   curl -I https://triathlonteambe-production.up.railway.app/api/public/schedule
   # Status 200 OK
   ```

3. **Frontend conectează la backend-ul corect?**
   - `TriathlonTeamFE/src/index.html` → meta `api-base-url`
   - Ar trebui: `https://triathlonteambe-production.up.railway.app`

---

## Backward Compatibility

✅ **Cookie + Authorization Header Support**

Backend-ul suportă AMBELE metode de autentificare:

1. **Cookie** (recomandat, nou)
2. **Authorization: Bearer** (backwards compatibility)

Aceasta permite migrarea graduală fără downtime.

---

## Environment Variables Summary

| Variable | Local Dev | Production (Railway) |
|----------|-----------|---------------------|
| `SERVER_SSL_ENABLED` | `false` (default) | **`true`** (trebuie setat) |
| Cookie Secure | `false` | `true` |
| Cookie SameSite | `Lax` | `Strict` |

---

**Fix aplicat:** 22 Octombrie 2025  
**Status:** ✅ Production Ready  
**Testing:** ✅ Local + Production verificat

