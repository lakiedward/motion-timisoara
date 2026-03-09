# Deploy Frontend pe Railway

## Pași pentru deployment

### 1. Creează un nou proiect pe Railway

1. Mergi pe [Railway.app](https://railway.app)
2. Click pe **"New Project"**
3. Selectează **"Deploy from GitHub repo"**
4. Autentifică-te cu GitHub și selectează repo-ul `TriathlonTeamTimisoara`

### 2. Configurează serviciul Frontend

1. Railway va detecta automat `railway.toml` din directorul `TriathlonTeamFE`
2. Dacă nu îl detectează automat, setează:
   - **Root Directory**: `TriathlonTeamFE`
   - **Build Command**: (va folosi Dockerfile)
   - **Start Command**: `node dist/TriathlonTeamFE/server/server.mjs`

### 3. Configurează variabilele de mediu

În Railway Dashboard, pentru serviciul Frontend, adaugă:

- `PORT`: `4201` (optional, Railway setează automat)
- `NODE_ENV`: `production`

### 4. Configurează domeniul custom pe Railway

1. În Railway Dashboard, mergi la serviciul Frontend
2. Click pe tab-ul **"Settings"**
3. Scroll la **"Domains"**
4. Click pe **"Add Domain"**
5. Adaugă domeniul tău: `motiontimisoara.com` și `www.motiontimisoara.com`
6. Railway îți va da niște DNS records de configurat

### 5. Configurează DNS pe Namecheap

1. Mergi pe [Namecheap Dashboard](https://ap.www.namecheap.com/domains/domaincontrolpanel/motiontimisoara.com/domain)
2. Click pe **"Advanced DNS"**
3. Adaugă următoarele records (Railway îți va da exact valorile):

Pentru domeniul principal (`motiontimisoara.com`):
```
Type: CNAME
Host: www
Value: [railway-provided-value] (ex: your-app.up.railway.app)
TTL: Automatic

Type: A Record
Host: @
Value: [railway-provided-IP]
TTL: Automatic
```

**SAU** folosește CNAME Flattening:
```
Type: ALIAS/ANAME Record
Host: @
Value: [railway-provided-value]
TTL: Automatic
```

### 6. SSL/HTTPS

Railway oferă automat SSL certificat gratuit pentru domeniul tău custom. După ce DNS-ul se propagă (poate dura până la 24 ore, dar de obicei 1-2 ore), site-ul tău va fi disponibil pe HTTPS.

### 7. Actualizează Backend URL în Frontend

După deployment, actualizează `src/index.html`:

```html
<meta name="api-base-url" content="https://triathlonteambe-production.up.railway.app">
```

Sau creează o variabilă de mediu pe Railway pentru a seta backend URL-ul dinamic.

## Verificare

După deployment:
- Frontend: `https://motiontimisoara.com` sau `https://www.motiontimisoara.com`
- Backend: `https://triathlonteambe-production.up.railway.app`

## Troubleshooting

### Eroare CORS
- Verifică că backend-ul acceptă domeniul nou în `CORS_ALLOWED_ORIGINS`
- Verifică că variabilele de mediu pe Railway sunt actualizate

### Site nu se încarcă
- Verifică logs pe Railway Dashboard
- Verifică că DNS records sunt configurate corect
- Așteaptă propagarea DNS (poate dura până la 24 ore)

### Build fails
- Verifică că toate dependențele sunt în `package.json`
- Verifică logs de build pe Railway pentru erori specifice

