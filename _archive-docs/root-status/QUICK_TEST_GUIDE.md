# 🚀 Quick Test Guide - Motion Timișoara

## ⚡ TL;DR - Rulează Rapid

```powershell
# Înainte de ORICE deploy:
.\run-e2e-tests.ps1 -Mode smoke

# Dacă PASS, rulează testele complete:
.\run-e2e-tests.ps1 -Mode full

# Vizualizează raportul:
.\run-e2e-tests.ps1 -Mode report
```

## 📊 Ce Testează?

### ✅ Smoke Tests (1-2 min)
- Homepage UP
- API funcțional
- CSS/JS încărcat
- HTTPS activ
- Zero erori critice
- Performance < 5s

### ✅ Production Tests (5-10 min)
- Login/Register pages
- Cursuri listing
- Navigare completă
- Mobile responsive
- Security headers
- Form validation

## 🎯 Pre-Deploy Checklist

```
[ ] Backend rulează pe Railway
[ ] Frontend deployed pe Netlify
[ ] Meta tag api-base-url corect
[ ] Smoke tests PASS
[ ] Full tests PASS
[ ] Manual check: login works
[ ] Manual check: cursuri visible
```

## 🐛 Dacă Eșuează

1. **Verifică screenshots:** `test-results/`
2. **UI Mode:** `.\run-e2e-tests.ps1 -Mode ui`
3. **Check production:** https://www.motiontimisoara.com
4. **Check API:** https://api.motiontimisoara.com/swagger-ui.html

## 📁 Fișiere Importante

- `playwright.config.ts` - Configurație
- `tests/smoke-tests.spec.ts` - Smoke tests
- `tests/production-readiness.spec.ts` - Production tests
- `run-e2e-tests.ps1` - Script PowerShell

## 💡 Tips

- Rulează smoke tests după FIECARE deploy
- Rulează full suite săptămânal
- Keep tests up-to-date cu UI changes
- Add new tests pentru new features

## 🔗 Links Rapide

- [Documentație completă](./E2E_PRODUCTION_TESTS.md)
- [Test README](./tests/README.md)
- [Playwright Docs](https://playwright.dev/)

---

**Remember:** Un deploy fără teste = un deploy cu risc! 🎲
