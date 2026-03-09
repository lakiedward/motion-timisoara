# Test Cookie Authentication - Quick Guide

## 🧪 Testing Fix pentru Reload Page Logout

### Pași de Test:

1. **Asigură-te că backend-ul rulează:**
   ```bash
   cd TriathlonTeamBE
   .\gradlew.bat bootRun
   ```
   Așteaptă mesajul: `Started TriathlonTeamBeApplication`

2. **Pornește frontend-ul (terminal nou):**
   ```bash
   cd TriathlonTeamFE
   npm start
   ```
   Acesează: http://localhost:4200

3. **Test Login și Reload:**
   - Login cu credențiale valide
   - **ÎNAINTE DE FIX:** La reload (F5) → delogat ❌
   - **DUPĂ FIX:** La reload (F5) → rămâi logat ✅

4. **Verifică cookie-ul în DevTools:**
   - F12 → Application → Cookies → http://localhost:8081
   - Caută: `access_token`
   - **Properties ar trebui să fie:**
     - ✅ `HttpOnly: true`
     - ✅ `Secure: false` (pentru localhost HTTP)
     - ✅ `SameSite: Lax`
     - ✅ `Path: /`
     - ✅ `Max-Age: 604800` (7 zile)

5. **Test logout:**
   - Click Logout
   - Cookie-ul ar trebui să dispară din DevTools

---

## 🔍 Debugging Dacă Nu Funcționează

### Check 1: Backend logs

Verifică în console când faci login:
```
Set auth cookie: secure=false, sameSite=Lax
```

### Check 2: Network request la login

DevTools → Network → POST /api/auth/login → Response Headers:
```
Set-Cookie: access_token=eyJ...; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax
```

**NU ar trebui să vezi `Secure` în development!**

### Check 3: Request la /api/auth/me după reload

DevTools → Network → GET /api/auth/me → Request Headers:
```
Cookie: access_token=eyJ...
```

Cookie-ul ar trebui trimis automat de browser.

---

## ✅ Success Criteria

- [x] Login funcționează
- [x] Cookie `access_token` apare în DevTools
- [x] Cookie are `HttpOnly=true`, `Secure=false`, `SameSite=Lax`
- [x] Reload page (F5) → utilizatorul rămâne logat
- [x] Logout șterge cookie-ul
- [x] După logout, /api/auth/me returnează 401

---

**Pentru Production (Railway):**

Setează `SERVER_SSL_ENABLED=true` în Railway Environment Variables pentru:
- `Secure: true`
- `SameSite: Strict`

