# 🚀 Quick Start - Deploy Frontend pe motiontimisoara.com

## ⚡ Pași Rapidi (5 minute)

### 1. Push modificările pe GitHub

```powershell
# Rulează script-ul automat
.\deploy-frontend.ps1
```

**SAU** manual:

```powershell
git add .
git commit -m "feat: configure Railway deployment and motiontimisoara.com domain"
git push origin main
```

### 2. Configurează Backend pe Railway (1 minut)

1. Mergi pe https://railway.app
2. Găsește proiectul **triathlonteambe-production**
3. Click pe **Variables**
4. Adaugă/Actualizează variabila:

```
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:4201,http://motiontimisoara.com,https://motiontimisoara.com,http://www.motiontimisoara.com,https://www.motiontimisoara.com
```

5. **Save** → Backend se va restarta automat

### 3. Deploy Frontend pe Railway (2 minute)

1. Pe Railway Dashboard, click **"New Project"**
2. Selectează **"Deploy from GitHub repo"**
3. Alege repo-ul `TriathlonTeamTimisoara`
4. Setează:
   - **Name**: `motion-timisoara-frontend`
   - **Root Directory**: `TriathlonTeamFE`
5. Așteaptă build-ul să se termine (2-5 minute)

### 4. Adaugă Domeniul Custom (1 minut)

1. În serviciul Frontend pe Railway
2. Mergi la **Settings** → **Networking** → **Domains**
3. Click **"Add Domain"**
4. Adaugă:
   - `motiontimisoara.com`
   - `www.motiontimisoara.com`

Railway îți va afișa DNS records de configurat.

### 5. Configurează DNS pe Namecheap (1 minut)

1. Mergi pe: https://ap.www.namecheap.com/domains/domaincontrolpanel/motiontimisoara.com/domain
2. Click pe **"Advanced DNS"**
3. Adaugă records (Railway îți va da valorile exacte):

```
Type: CNAME
Host: www
Value: [your-app].up.railway.app
TTL: Automatic

Type: URL Redirect
Host: @
Value: http://www.motiontimisoara.com
TTL: Automatic
```

### 6. Verificare (după 1-2 ore)

- Frontend: https://motiontimisoara.com ✅
- Backend: https://triathlonteambe-production.up.railway.app ✅
- SSL: Automat de la Railway ✅

---

## 📚 Documentație Completă

- **DOMAIN_SETUP_GUIDE.md** - Ghid complet cu toate detaliile
- **TriathlonTeamFE/RAILWAY_DEPLOYMENT.md** - Deployment specific Railway
- **AGENTS.md** - Guidelines pentru development

---

## 🆘 Troubleshooting Rapid

### Eroare CORS
```
✅ Verifică că CORS_ALLOWED_ORIGINS este setat corect pe Railway Backend
✅ Restart Backend service pe Railway
```

### Site nu se încarcă
```
✅ Verifică Logs pe Railway Dashboard
✅ Verifică că build-ul s-a terminat cu succes
```

### DNS nu funcționează
```
✅ Așteaptă 1-24 ore pentru propagare
✅ Verifică DNS cu: https://dnschecker.org
```

---

## ✨ Next Steps După Deployment

1. **Testează toate funcționalitățile:**
   - Login/Register
   - Course enrollment
   - Payment flow
   - Admin panel

2. **Optimizare SEO:**
   - Actualizează meta tags în `index.html`
   - Adaugă Google Analytics (dacă dorești)

3. **Monitoring:**
   - Verifică Logs pe Railway periodic
   - Configurează alerts pentru errors

---

**🎉 Gata! Site-ul tău va fi live în curând pe https://motiontimisoara.com**

