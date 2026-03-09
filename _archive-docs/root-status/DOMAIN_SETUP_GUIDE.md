# Ghid de Configurare Domeniu - motiontimisoara.com

## Overview

Acest ghid te va ajuta să configurezi domeniul `motiontimisoara.com` cu aplicația ta (Backend + Frontend pe Railway).

## Arhitectură

```
motiontimisoara.com (Frontend - Railway)
    ↓
https://triathlonteambe-production.up.railway.app (Backend - Railway)
```

## Status Actual

✅ Backend deployment existent: `https://triathlonteambe-production.up.railway.app`  
⏳ Frontend deployment: De configurat pe Railway  
⏳ DNS Configuration: De configurat pe Namecheap

---

## Pași de Implementare

### Pasul 1: Commit și Push modificările Backend

```powershell
cd TriathlonTeamBE
git add src/main/resources/application.yml
git commit -m "feat: add motiontimisoara.com to CORS allowed origins"
git push origin main
```

Backend-ul se va re-deploya automat pe Railway și va accepta request-uri de la noul domeniu.

### Pasul 2: Actualizează variabile Railway pentru Backend

1. Mergi pe [Railway Dashboard](https://railway.app)
2. Găsește proiectul `triathlonteambe-production`
3. Click pe **Variables**
4. Adaugă/Actualizează:
   ```
   CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:4201,http://motiontimisoara.com,https://motiontimisoara.com,http://www.motiontimisoara.com,https://www.motiontimisoara.com
   ```
5. Click **Save** - Backend-ul se va restarta automat

### Pasul 3: Deploy Frontend pe Railway

1. **Commit modificările Frontend:**
   ```powershell
   cd TriathlonTeamFE
   git add Dockerfile railway.toml .dockerignore RAILWAY_DEPLOYMENT.md
   git commit -m "feat: add Railway deployment configuration for frontend"
   git push origin main
   ```

2. **Creează nou serviciu pe Railway:**
   - Mergi pe [Railway.app](https://railway.app)
   - Click **"New Project"** → **"Deploy from GitHub repo"**
   - Selectează repo-ul `TriathlonTeamTimisoara`
   - În **Service Settings**, setează:
     - **Name**: `TriathlonTeamFE` sau `motion-timisoara-frontend`
     - **Root Directory**: `TriathlonTeamFE`
     - Railway va detecta automat `Dockerfile` și `railway.toml`

3. **Așteaptă build-ul să se termine** (2-5 minute)

### Pasul 4: Configurează Domeniul Custom pe Railway

1. În Railway Dashboard, click pe serviciul Frontend
2. Mergi la tab-ul **"Settings"**
3. Scroll la secțiunea **"Networking"** → **"Domains"**
4. Click **"Add Domain"**
5. Adaugă domeniile:
   - `motiontimisoara.com`
   - `www.motiontimisoara.com`

Railway îți va afișa DNS records de configurat.

### Pasul 5: Configurează DNS pe Namecheap

1. **Mergi pe Namecheap:**
   - URL: https://ap.www.namecheap.com/domains/domaincontrolpanel/motiontimisoara.com/domain
   - Login cu contul tău

2. **Click pe tab-ul "Advanced DNS"**

3. **Adaugă DNS Records:**

   Railway îți va oferi o adresă de tipul: `your-app-name.up.railway.app`

   **Configurare recomandată:**

   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | CNAME Record | www | `[railway-app].up.railway.app` | Automatic |
   | URL Redirect | @ | `http://www.motiontimisoara.com` | Automatic |

   **SAU** dacă Namecheap suportă ALIAS/ANAME:

   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | CNAME Record | www | `[railway-app].up.railway.app` | Automatic |
   | ALIAS/ANAME | @ | `[railway-app].up.railway.app` | Automatic |

4. **Salvează modificările**

### Pasul 6: Așteaptă propagarea DNS

- DNS propagarea poate dura între **15 minute și 24 ore**
- De obicei, în România, durează **1-2 ore**
- Poți verifica statusul DNS cu: https://dnschecker.org

### Pasul 7: Verificare

După ce DNS-ul s-a propagat:

1. **Verifică Frontend:**
   - Deschide: `https://motiontimisoara.com`
   - Deschide: `https://www.motiontimisoara.com`
   - Ar trebui să vezi aplicația Angular

2. **Verifică conexiunea la Backend:**
   - Login/Register ar trebui să funcționeze
   - Verifică Console (F12) pentru erori CORS

3. **Verifică SSL:**
   - Railway oferă automat SSL gratuit
   - Site-ul ar trebui să fie pe HTTPS

---

## Configurări Alternative

### Opțiunea A: Păstrează Backend URL Production

Lasă `index.html` așa cum este:
```html
<meta name="api-base-url" content="https://triathlonteambe-production.up.railway.app">
```

✅ Avantaje: Simplu, Backend deja funcțional  
❌ Dezavantaje: Backend URL vizibil în surse

### Opțiunea B: Folosește Backend URL Custom

Dacă vrei să ascunzi backend URL-ul, poți seta:
```html
<meta name="api-base-url" content="">
```

Și configurezi un **reverse proxy** pe Railway sau Cloudflare pentru `/api/*` → backend.

---

## Local Development

Pentru development local, folosești:

1. **Backend local:**
   ```powershell
   cd TriathlonTeamBE
   .\gradlew.bat bootRun
   ```
   Backend: `http://localhost:8081`

2. **Frontend local:**
   ```powershell
   cd TriathlonTeamFE
   npm start
   ```
   Frontend: `http://localhost:4200`

3. **Actualizează temporar `index.html` pentru local:**
   ```html
   <meta name="api-base-url" content="http://localhost:8081">
   ```
   
   ⚠️ **NU face commit** la această modificare pentru local dev!

---

## Troubleshooting

### ❌ Eroare: "CORS policy: No 'Access-Control-Allow-Origin'"

**Soluție:**
1. Verifică că Backend acceptă domeniul în CORS
2. Verifică variabila `CORS_ALLOWED_ORIGINS` pe Railway
3. Restart Backend service pe Railway

### ❌ Site nu se încarcă după deployment

**Soluție:**
1. Verifică Logs pe Railway Dashboard
2. Verifică că build-ul s-a terminat cu succes
3. Verifică că portul este setat corect (Railway setează automat `$PORT`)

### ❌ DNS nu se propagă

**Soluție:**
1. Verifică că DNS records sunt corecte pe Namecheap
2. Așteaptă 24 ore pentru propagare completă
3. Verifică cu: `nslookup motiontimisoara.com`

### ❌ SSL Certificate Error

**Soluție:**
1. Railway generează automat SSL după ce DNS-ul se propagă
2. Poate dura 10-30 minute după propagarea DNS
3. Verifică pe Railway Dashboard → Settings → Domains

---

## Resurse Utile

- [Railway Documentation](https://docs.railway.app)
- [Namecheap DNS Setup](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/)
- [DNS Checker Tool](https://dnschecker.org)
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html)

---

## Contact & Support

Dacă întâmpini probleme:
1. Verifică Railway Logs: Dashboard → Service → Deployments → View Logs
2. Verifică Browser Console (F12) pentru erori
3. Verifică Backend Swagger: `https://triathlonteambe-production.up.railway.app/swagger-ui.html`

