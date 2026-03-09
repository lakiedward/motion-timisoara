# 🏃 COACH Page Patterns (`/coach/*`)

## ⚠️ REGULĂ STRICTĂ

**Paginile Coach sunt similare cu Admin, dar tema este VERDE (Emerald).**

---

## Diferențe Coach vs Admin

| Element | Admin | Coach |
| :--- | :--- | :--- |
| **Primary Color** | Amber (`#f59e0b`) | Emerald (`#10b981`) |
| **Badge** | `badge--warning` | `badge--coach` |
| **Hero Gradient** | Blue → Amber tint | Blue → Green tint |
| **Hero Button** | `--gradient-warm` | `--gradient-green` |
| **Title Span Color** | `--sport-accent` | `#10b981` |
| **Shadow** | Amber shadow | Green shadow |

---

## Tema Culorilor Coach

| Element | Valoare |
| :--- | :--- |
| **Primary** | `#10b981` (Emerald 500) |
| **Primary Dark** | `#059669` (Emerald 600) |
| **Light Tint** | `#ecfdf5` (Emerald 50) |
| **Gradient** | `linear-gradient(135deg, #10b981 0%, #34d399 100%)` |
| **Shadow** | `0 4px 15px rgba(16, 185, 129, 0.3)` |

---

## 1. Page Hero Coach

### Hero Gradient (OBLIGATORIU pentru Coach)
```scss
background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #ecfdf5 100%);
```

### SCSS Complet
```scss
.page-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.5rem;
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #ecfdf5 100%);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-subtle);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
}

.hero-title {
  span {
    color: #10b981; // VERDE pentru Coach!
  }
}

.hero-btn {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);

  &:hover {
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
  }
}
```

---

## 2. Badge Coach

```scss
.badge--coach {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #10b981;
}
```

### HTML
```html
<span class="badge badge--coach">Antrenor</span>
```

---

## 3. Stat Icons Coach

Pentru Coach, folosiți variante verzi:

```scss
.stat-icon {
  &--coach-primary {
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  }
  
  &--coach-secondary {
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  }
}
```

---

## 4. Action Cards (Dashboard Coach)

```scss
.action-card {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border-subtle);
  padding: 1.5rem;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: #10b981;
    box-shadow: 0 12px 30px rgba(16, 185, 129, 0.15);
  }

  &__icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;

    mat-icon {
      color: white;
      font-size: 1.5rem;
    }
  }
}
```

---

## 5. Layout Structure

Coach folosește `CoachLayoutComponent` cu:
- Header unificat (ca Admin)
- Fără sidebar separat
- Navigation prin tabs în header

### Structura Paginii Coach
```
┌─────────────────────────────────────────┐
│  PAGE HERO (Green Theme)                │
│  Badge "Antrenor" + Title + Action Btn  │
└─────────────────────────────────────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐
│ Stat 1   │  │ Stat 2   │  │ Stat 3   │
│ (Green)  │  │ (Blue)   │  │ (Amber)  │
└──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────────────┐
│  SECTION CARD (White)                   │
│  Content...                             │
└─────────────────────────────────────────┘
```

---

## 6. Pagini Coach Specifice

### Dashboard (`/coach/dashboard`)
- Quick stats (cursuri, prezențe, anunțuri)
- Action cards cu link-uri rapide
- Recent activity feed

### Cursuri (`/coach/courses`)
- Grid de course cards
- Fiecare card arată: nume, program, participanți

### Prezențe (`/coach/attendance-payments`)
- Tabel cu filtre pe cursuri/date
- Toggle-uri pentru marcare prezență
- Indicatori plăți

### Anunțuri (`/coach/announcements`)
- Lista de anunțuri postate
- Form pentru anunț nou
- Upload imagini

---

## ✅ Checklist pentru Pagini Coach Noi

- [ ] **Hero gradient** are tint verde la final (`#ecfdf5`)?
- [ ] **Element decorativ** `::before` are rgba verde?
- [ ] **Badge** este `badge--coach` (verde)?
- [ ] **Butonul principal** are gradient verde?
- [ ] **Title span** are culoare `#10b981`?
- [ ] **Hover effects** au tint verde?
- [ ] **Shadows** pe butoane au rgba verde?

---

## Template SCSS Coach (Copy-Paste)

```scss
// ============================================
// COACH PAGE - GREEN THEME
// ============================================

:host {
  display: block;
}

.coach-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.5rem;
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #ecfdf5 100%);
  border-radius: var(--radius-card, 24px);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-subtle);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
}

.hero-content {
  flex: 1;
  position: relative;
  z-index: 1;
}

.hero-title {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 800;
  color: var(--sport-text-dark);

  span {
    color: #10b981; // GREEN for Coach
  }
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  border: none;
  border-radius: var(--radius-btn, 50px);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
  position: relative;
  z-index: 1;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
  }
}

.badge--coach {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #10b981;
}
```
