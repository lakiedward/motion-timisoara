# 🤖 Master Rules - AI Agent Instructions

**Acest fișier este INDEX-ul pentru agenții AI.** Definește cum să aplici regulile UI.

---

## 📁 Structura Documentației

```
src/docs/ui-guidelines/
├── 00_CORE_Tokens.md       # Variabile CSS, Culori, Typography
├── 01_Global_Components.md # Butoane, Carduri, Badges
├── 02_Admin_Patterns.md    # ⚠️ CRITIC: Layout-uri /admin
├── 03_Coach_Patterns.md    # ⚠️ CRITIC: Layout-uri /coach
├── 04_Club_Patterns.md     # Layout-uri /club
├── 05_Account_Patterns.md  # Layout-uri /account (user logat)
├── 06_Public_Patterns.md   # Pagini publice (Home, Cursuri)
├── 07_Form_Patterns.md     # Pagini Create/Edit
├── 08_Mobile_Layouts.md    # Responsive design
├── 09_Angular_Standards.md # Signals, Forms, Arhitectură
├── 10_Navigation_Media.md  # Navbar, Avatare, Imagini
└── 11_Master_Rules.md      # ACEST FIȘIER (index)
```

---

## 🎯 Strategia de Recuperare

### Pas 1: Identifică Contextul

| Dacă user-ul întreabă despre... | Citește... |
| :--- | :--- |
| Culori, fonturi, spacing | `00_CORE_Tokens.md` |
| Butoane, carduri, badges | `01_Global_Components.md` |
| Pagini din `/admin/*` | `02_Admin_Patterns.md` ⚠️ |
| Pagini din `/coach/*` | `03_Coach_Patterns.md` ⚠️ |
| Pagini din `/club/*` | `04_Club_Patterns.md` |
| Pagini din `/account/*` | `05_Account_Patterns.md` |
| Pagini publice (Home, Cursuri) | `06_Public_Patterns.md` |
| Formulare create/edit | `07_Form_Patterns.md` |
| Mobile, responsive | `08_Mobile_Layouts.md` |
| Angular, signals, forms | `09_Angular_Standards.md` |
| Navigație, imagini | `10_Navigation_Media.md` |

### Pas 2: Aplică Regulile de Temă

```
IF context === 'admin':
  → Folosește AMBER/ORANGE pentru primary
  → Hero gradient: Blue → Light → Amber tint (#fffbeb)
  → Badge: badge--warning
  → Button: --gradient-warm
  → Title span: --sport-accent (#f59e0b)
  → Shadow: rgba(245, 158, 11, 0.3)

IF context === 'coach':
  → Folosește EMERALD/GREEN pentru primary
  → Hero gradient: Blue → Light → Green tint (#ecfdf5)
  → Badge: badge--coach
  → Button: gradient green (#10b981 → #34d399)
  → Title span: #10b981
  → Shadow: rgba(16, 185, 129, 0.3)

IF context === 'club':
  → Folosește INDIGO pentru primary
  → Hero gradient: Blue → Light → Indigo tint (#eef2ff)
  → Badge: badge--club
  → Button: gradient indigo (#6366f1 → #818cf8)
  → Title span: #6366f1
  → Shadow: rgba(99, 102, 241, 0.3)

IF context === 'account':
  → Folosește BLUE pentru primary
  → Hero: Compact, alb cu border
  → Badge: badge--primary
  → Button: --gradient-primary
  → Background: --sport-bg-light
  → Design simplificat, prietenos

IF context === 'public':
  → Folosește BLUE pentru primary
  → Hero: Full-width cu imagine de fundal
  → CTA: Amber pentru highlight
  → Badge: badge--primary
  → Button: --gradient-primary
  → Focus pe atragere clienți
```

---

## ⚠️ Erori Frecvente de Evitat

### 1. Hero Admin cu Fundal Alb
```scss
// ❌ GREȘIT
.page-hero {
  background: white;
}

// ✅ CORECT
.page-hero {
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #fffbeb 100%);
}
```

### 2. Buton Admin cu Gradient Albastru
```scss
// ❌ GREȘIT (pentru Admin)
.hero-btn {
  background: var(--gradient-primary); // Albastru
}

// ✅ CORECT (pentru Admin)
.hero-btn {
  background: var(--gradient-warm); // Amber
}
```

### 3. Title Span cu Culoare Greșită
```scss
// ❌ GREȘIT (pentru Admin)
.hero-title span {
  color: var(--sport-primary); // Albastru
}

// ✅ CORECT (pentru Admin)
.hero-title span {
  color: var(--sport-accent); // Amber
}
```

### 4. Lipsă Element Decorativ
```scss
// ❌ LIPSEȘTE ::before pe hero admin/coach
.page-hero {
  // doar background
}

// ✅ CORECT
.page-hero {
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
}
```

### 5. Lipsă z-index pe Hero Content
```scss
// ❌ GREȘIT
.hero-content {
  flex: 1;
}

// ✅ CORECT
.hero-content {
  flex: 1;
  position: relative;
  z-index: 1;
}
```

---

## 📋 Checklist Înainte de Finalizare

### Pentru Orice Pagină Admin
- [ ] Hero are gradient (NU alb)?
- [ ] Hero are element decorativ `::before`?
- [ ] Butonul principal e Amber?
- [ ] Badge e `badge--warning`?
- [ ] Title span e Amber (`--sport-accent`)?
- [ ] z-index e setat pe hero-content și hero-btn?
- [ ] Stats row există cu 3 carduri?
- [ ] Responsive pe mobile funcționează?

### Pentru Orice Pagină Coach
- [ ] Hero gradient are tint verde la final?
- [ ] Element decorativ are rgba verde?
- [ ] Butonul principal e verde?
- [ ] Badge e `badge--coach`?
- [ ] Title span e `#10b981`?

### Pentru Code Angular
- [ ] Component e `standalone: true`?
- [ ] Change detection e `OnPush`?
- [ ] State folosește `signal()`?
- [ ] Subscriptions au `takeUntilDestroyed()`?

---

## 🔧 Template-uri Rapide

### Admin Page Template
Când creezi o pagină nouă în `/admin/*`, copiază structura din:
- **HTML:** `admin-coach-list.component.html` (primele 50 linii)
- **SCSS:** `admin-coach-list.component.scss`

### Coach Page Template
Când creezi o pagină nouă în `/coach/*`:
- Copiază template-ul din `03_Coach_Patterns.md`
- Schimbă culorile din Amber în Verde

### Form Page Template
Când creezi o pagină de create/edit:
- Consultă `04_Form_Patterns.md`
- Folosește secțiuni grupate

---

## 📝 Comenzi Rapide pentru Agent

Când primești o cerere:

1. **"Creează pagină admin X"**
   → Citește `02_Admin_Patterns.md`
   → Copiază template-ul complet
   → Personalizează conținutul

2. **"Fix styling pe pagina Y"**
   → Identifică zona (admin/coach/public)
   → Verifică checklist-ul relevant
   → Corectează deviațiile

3. **"Adaugă componentă Z"**
   → Citește `01_Global_Components.md`
   → Folosește stilurile globale
   → Nu reinventa roata

4. **"Fă responsive"**
   → Citește `05_Mobile_Layouts.md`
   → Aplică breakpoints corect
   → Testează pe 768px

---

## 🎨 Quick Reference - Culori pe Zone

| Zonă | Primary | Accent/Button | Hero Gradient End | Badge |
| :--- | :--- | :--- | :--- | :--- |
| **Public** | `#2563eb` (Blue) | `#f59e0b` (Amber CTA) | White/Image | `badge--primary` |
| **Account** | `#2563eb` (Blue) | `#2563eb` (Blue) | White (compact) | `badge--primary` |
| **Admin** | `#2563eb` (Blue) | `#f59e0b` (Amber) | `#fffbeb` | `badge--warning` |
| **Coach** | `#2563eb` (Blue) | `#10b981` (Green) | `#ecfdf5` | `badge--coach` |
| **Club** | `#2563eb` (Blue) | `#6366f1` (Indigo) | `#eef2ff` | `badge--club` |

---

## 📚 Referințe Externe

- **Tailwind Colors:** https://tailwindcss.com/docs/colors
- **Angular Material:** https://material.angular.io/
- **Lucide Icons:** https://lucide.dev/icons/
- **Google Fonts - Manrope:** https://fonts.google.com/specimen/Manrope
- **Google Fonts - Inter:** https://fonts.google.com/specimen/Inter
