# 🛡️ ADMIN Page Patterns (`/admin/*`)

## ⚠️ REGULĂ STRICTĂ

**TOATE paginile din `/admin/*` TREBUIE să respecte EXACT aceste reguli.**

Orice deviere de la aceste pattern-uri creează **inconsistență vizuală**.

---

## Tema Culorilor Admin

| Element | Valoare | Variabilă |
| :--- | :--- | :--- |
| **Primary Action** | Amber/Orange | `--gradient-warm` |
| **Hero Gradient** | Blue → Light → Amber tint | Custom |
| **Badge** | `badge--warning` | Amber |
| **Stat Icons** | Blue, Green, Amber | Gradient |

### Hero Gradient (OBLIGATORIU)
```scss
background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #fffbeb 100%);
```

**⚠️ NU folosiți fundal alb simplu (`#ffffff`) pentru Hero!**

---

## Structura Paginii Admin (OBLIGATORIE)

Fiecare pagină admin are această structură:

```
┌─────────────────────────────────────────┐
│  PAGE HERO                              │
│  ┌─────────────────┐  ┌──────────────┐  │
│  │ Badge + Title   │  │ Action Btn   │  │
│  │ Subtitle        │  │ (Amber)      │  │
│  └─────────────────┘  └──────────────┘  │
└─────────────────────────────────────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐
│ Stat 1   │  │ Stat 2   │  │ Stat 3   │
│ (Blue)   │  │ (Green)  │  │ (Amber)  │
└──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────────────┐
│  SECTION CARD                           │
│  ┌─────────────────────────────────┐    │
│  │ Section Header + Count Badge    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │ Card 1 │  │ Card 2 │  │ Card 3 │    │
│  └────────┘  └────────┘  └────────┘    │
└─────────────────────────────────────────┘
```

---

## 1. Page Hero Admin

### HTML Template
```html
<header class="page-hero">
  <div class="hero-content">
    <span class="badge badge--warning">Administrare</span>
    <h1 class="hero-title">Gestionare <span>Entitate</span></h1>
    <p class="hero-subtitle">Descriere scurtă a paginii</p>
  </div>
  <button class="hero-btn" (click)="action()">
    <mat-icon>add</mat-icon>
    <span>Acțiune Nouă</span>
  </button>
</header>
```

### SCSS (Copy-Paste Exact)
```scss
.page-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.5rem;
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light, #f8fafc) 50%, #fffbeb 100%);
  border-radius: var(--radius-card, 24px);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-subtle);
  position: relative;
  overflow: hidden;

  // Decorative element
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
  letter-spacing: -0.02em;

  span {
    color: var(--sport-accent, #f59e0b); // AMBER pentru Admin!
  }
}

.hero-subtitle {
  margin: 0;
  color: var(--sport-text-muted);
  font-size: 1rem;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--gradient-warm, linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%));
  border: none;
  border-radius: var(--radius-btn, 50px);
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
  position: relative;
  z-index: 1;

  mat-icon {
    font-size: 1.25rem;
    width: 1.25rem;
    height: 1.25rem;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
  }
}
```

---

## 2. Stats Row

### HTML Template
```html
<div class="stats-row">
  <div class="stat-card">
    <div class="stat-icon stat-icon--blue">
      <mat-icon>event</mat-icon>
    </div>
    <div class="stat-info">
      <span class="stat-number">{{ total() }}</span>
      <span class="stat-label">Total entități</span>
    </div>
  </div>
  <div class="stat-card">
    <div class="stat-icon stat-icon--green">
      <mat-icon>check_circle</mat-icon>
    </div>
    <div class="stat-info">
      <span class="stat-number">{{ active() }}</span>
      <span class="stat-label">Active</span>
    </div>
  </div>
  <div class="stat-card">
    <div class="stat-icon stat-icon--amber">
      <mat-icon>group</mat-icon>
    </div>
    <div class="stat-info">
      <span class="stat-number">{{ count() }}</span>
      <span class="stat-label">Alt stat</span>
    </div>
  </div>
</div>
```

### SCSS
```scss
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-subtle);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-card-hover);
  }
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  flex-shrink: 0;

  mat-icon {
    font-size: 1.75rem;
    width: 1.75rem;
    height: 1.75rem;
    color: white;
  }

  &--blue { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); }
  &--green { background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%); }
  &--amber { background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); }
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-number {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--sport-text-dark);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--sport-text-muted);
  margin-top: 0.25rem;
}
```

---

## 3. Section Card cu Header

### HTML Template
```html
<section class="section-card">
  <div class="section-header">
    <div class="section-header__left">
      <h2 class="section-title">
        <mat-icon>event_note</mat-icon>
        Lista Entități
      </h2>
      <span class="section-count">{{ items().length }}</span>
    </div>
    <!-- Optional: Filters -->
    <div class="chips">
      <button [class.active]="filter() === 'all'">Toate</button>
      <button [class.active]="filter() === 'active'">Active</button>
    </div>
  </div>

  <!-- Content Grid -->
  <div class="entity-grid">
    @for (item of items(); track item.id) {
      <article class="entity-card">...</article>
    }
  </div>
</section>
```

### SCSS
```scss
.section-card {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 2rem;
  border: 1px solid var(--color-border-subtle);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);

  &__left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sport-text-dark);

  mat-icon {
    color: var(--sport-primary);
  }
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 0.5rem;
  background: var(--sport-primary);
  color: white;
  border-radius: 50px;
  font-size: 0.8rem;
  font-weight: 700;
}
```

---

## 4. Entity Card (pentru liste)

### ⚠️ ACȚIUNI ÎN HEADER!

**Toate butoanele (edit, toggle, delete) sunt în header. Footer are doar stats!**

### HTML Template
```html
<article class="entity-card" [class.entity-card--inactive]="!item.active">
  <!-- HEADER: Icon + ALL Actions -->
  <div class="entity-card__header">
    <div class="entity-icon">
      <mat-icon>event</mat-icon>
    </div>
    <div class="entity-card__actions">
      <button class="action-btn action-btn--edit" matTooltip="Editează">
        <mat-icon>edit</mat-icon>
      </button>
      <button class="action-btn action-btn--toggle" 
              [class.action-btn--active]="item.active"
              [matTooltip]="item.active ? 'Dezactivează' : 'Activează'">
        <mat-icon>power_settings_new</mat-icon>
      </button>
      <button class="action-btn action-btn--delete" matTooltip="Șterge">
        <mat-icon>delete</mat-icon>
      </button>
    </div>
  </div>

  <!-- BODY: Badge + Name + Meta -->
  <div class="entity-card__body">
    <span class="badge" [class.badge--success]="item.active">
      {{ item.active ? 'Activ' : 'Inactiv' }}
    </span>
    <h3 class="entity-card__name">{{ item.name }}</h3>
    <div class="entity-card__meta">
      <div class="meta-item">
        <mat-icon>calendar_today</mat-icon>
        <span>{{ item.date }}</span>
      </div>
    </div>
  </div>

  <!-- FOOTER: Stats ONLY -->
  <div class="entity-card__footer">
    <div class="entity-card__stats">
      <div class="stat-mini">
        <mat-icon>group</mat-icon>
        <span>{{ item.count }}</span>
      </div>
    </div>
  </div>
</article>
```

### Grid pentru Entity Cards
```scss
.entity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}
```

---

## ✅ Checklist pentru Pagini Admin Noi

Înainte de a considera pagina completă, verifică:

- [ ] **Hero** are gradient (NU fundal alb simplu)?
- [ ] **Hero** are element decorativ `::before`?
- [ ] **Butonul principal** este Amber/Orange (`--gradient-warm`)?
- [ ] **Badge-ul** din hero este `badge--warning`?
- [ ] **Span-ul** din titlu are culoare `--sport-accent` (amber)?
- [ ] **Stats Row** există cu 3 stat cards?
- [ ] **Section Card** are header cu titlu + count badge?
- [ ] **Cardurile** au border subtil și hover effect?
- [ ] **z-index** e setat corect pe hero-content și hero-btn?
- [ ] **Responsive**: funcționează pe mobile (768px)?

---

## Pagini Admin Existente (Referință)

| Pagină | Path | Status |
| :--- | :--- | :--- |
| Antrenori | `/admin/coaches` | ✅ Implementat corect |
| Cursuri | `/admin/courses` | ✅ Referință |
| Locații | `/admin/locations` | ✅ Implementat |
| Tabere | `/admin/camps` | Verifică |
| Activități | `/admin/activities` | ✅ Actualizat |
| Plăți | `/admin/payments` | Verifică |

**Când creezi o pagină nouă, copiază SCSS-ul din `/admin/coaches`!**
