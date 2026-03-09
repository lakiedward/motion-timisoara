# 👤 ACCOUNT Page Patterns (`/account/*`)

## Context

Paginile Account sunt pentru **părinții/utilizatorii logați** - interfață simplă și prietenoasă.

Tema: **BLUE principal** cu elemente moderne și clare.

---

## Caracteristici Account

| Element | Valoare |
| :--- | :--- |
| **Primary Color** | `#2563eb` (Blue) |
| **Background** | `--sport-bg-light` (#f8fafc) |
| **Hero** | Compact, fără gradient elaborate |
| **Badge** | `badge--primary` (Blue) |
| **Accent** | Blue pentru acțiuni |

---

## Diferența față de Admin/Coach/Club

| Aspect | Admin/Coach/Club | Account |
| :--- | :--- | :--- |
| **Hero** | Gradient colorat + decorativ | Simplu, compact |
| **Stats** | 3 carduri statistici | Opțional sau integrat |
| **Complexitate** | Management avansat | Interfață simplificată |
| **Acțiuni** | Multiple pe pagină | Focus pe una sau două |

---

## 1. Page Hero Account (Compact)

### HTML Template
```html
<section class="page-hero">
  <div class="page-hero__container">
    <!-- Optional: Back button -->
    <button class="back-button" routerLink="/account">
      <mat-icon>arrow_back</mat-icon>
      Înapoi
    </button>
    
    <div class="page-hero__content">
      <span class="page-hero__eyebrow">Contul meu</span>
      <h1 class="page-hero__title">Copiii mei</h1>
      <p class="page-hero__subtitle">Gestionează profilurile copiilor</p>
    </div>
    
    <!-- Optional: Action -->
    <button class="btn-primary" (click)="addChild()">
      <mat-icon>add</mat-icon>
      Adaugă copil
    </button>
  </div>
</section>
```

### SCSS
```scss
.page-hero {
  background: var(--sport-bg-white);
  padding: 2rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
  
  &__container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }
  
  &__content {
    flex: 1;
  }
  
  &__eyebrow {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--sport-primary);
    margin-bottom: 0.5rem;
  }
  
  &__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 800;
    color: var(--sport-text-dark);
  }
  
  &__subtitle {
    margin: 0.25rem 0 0;
    color: var(--sport-text-muted);
    font-size: 0.95rem;
  }
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-btn);
  color: var(--sport-text-muted);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--sport-primary);
    color: var(--sport-primary);
  }
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-btn);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-btn-primary);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
  }
}
```

---

## 2. Dashboard Account

### Layout
```
┌─────────────────────────────────────────┐
│  HERO: Bun venit, [Nume]                │
└─────────────────────────────────────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐
│ Copii    │  │ Cursuri  │  │ Anunțuri │
│ (Card)   │  │ Active   │  │ (Badge)  │
└──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────────────┐
│  QUICK ACTIONS                          │
│  [Adaugă copil] [Vezi înscrieri]        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  RECENT ACTIVITY                        │
│  - Ultimele anunțuri                    │
│  - Plăți recente                        │
└─────────────────────────────────────────┘
```

### Welcome Card
```html
<div class="welcome-card">
  <div class="welcome-card__avatar">
    {{ getInitials(user.name) }}
  </div>
  <div class="welcome-card__content">
    <h1>Bun venit, {{ user.name }}!</h1>
    <p>Aici poți gestiona contul și activitățile copiilor tăi.</p>
  </div>
</div>
```

```scss
.welcome-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: var(--gradient-primary);
  border-radius: var(--radius-card);
  color: white;
  
  &__avatar {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  &__content h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  &__content p {
    margin: 0.5rem 0 0;
    opacity: 0.9;
  }
}
```

---

## 3. Content Cards (Account)

### Child Card
```html
<article class="child-card">
  <div class="child-card__avatar">
    <img *ngIf="child.photoUrl" [src]="child.photoUrl" />
    <span *ngIf="!child.photoUrl">{{ getInitials(child.name) }}</span>
  </div>
  <div class="child-card__info">
    <h3>{{ child.name }}</h3>
    <p>{{ child.age }} ani</p>
    <div class="child-card__badges">
      <span class="badge badge--primary">{{ child.level }}</span>
    </div>
  </div>
  <div class="child-card__actions">
    <button mat-icon-button routerLink="/account/children/{{ child.id }}">
      <mat-icon>chevron_right</mat-icon>
    </button>
  </div>
</article>
```

```scss
.child-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border-subtle);
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-2px);
  }
  
  &__avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    overflow: hidden;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  &__info {
    flex: 1;
    
    h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--sport-text-dark);
    }
    
    p {
      margin: 0.25rem 0;
      color: var(--sport-text-muted);
      font-size: 0.875rem;
    }
  }
  
  &__badges {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  &__actions {
    color: var(--sport-text-muted);
  }
}
```

---

## 4. Pagini Account Specifice

### Dashboard (`/account`)
- Card bun venit cu avatar
- Statistici rapide (copii, cursuri active, anunțuri noi)
- Quick actions

### Copiii mei (`/account/children`)
- Grid de child cards
- Buton adaugă copil
- Link la profil individual

### Profil copil (`/account/children/:id`)
- Hero cu foto și nume
- Informații detaliate
- Secțiuni: Date, Cursuri active, Prezențe

### Înscrieri și Plăți (`/account/enrollments`)
- Tabel cu înscrieri
- Status plăți
- Istoric

### Anunțuri (`/account/announcements`)
- Feed anunțuri de la cursuri
- Badge "Nou" pentru < 7 zile
- Infinite scroll

---

## 5. Badge-uri Account

```scss
.badge--primary {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
  border: 1px solid #3b82f6;
}

.badge--new {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 1px solid #f59e0b;
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
}
```

---

## 6. Mobile Adjustments

```scss
@media (max-width: 768px) {
  .page-hero {
    padding: 1rem 0;
    
    &__container {
      flex-direction: column;
      text-align: center;
      gap: 1rem;
    }
    
    .btn-primary {
      width: 100%;
      justify-content: center;
    }
  }
  
  .welcome-card {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
  }
  
  .child-card {
    flex-wrap: wrap;
  }
}
```

---

## ✅ Checklist Pagini Account

- [ ] Hero este compact (fără gradient elaborate)?
- [ ] Fundal folosește `--sport-bg-light`?
- [ ] Butoane principale sunt Blue (`--gradient-primary`)?
- [ ] Cardurile au hover subtil?
- [ ] Navigarea este clară (back buttons)?
- [ ] Mobile friendly (stack vertical)?
- [ ] Loading states există?
- [ ] Empty states sunt prietenoase?

---

## Template SCSS Account

```scss
// ============================================
// ACCOUNT PAGE - BLUE THEME (SIMPLIFIED)
// ============================================

:host {
  display: block;
  background: var(--sport-bg-light);
  min-height: 100vh;
}

.account-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-hero {
  background: var(--sport-bg-white);
  padding: 2rem;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  
  &__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--sport-text-dark);
  }
}

.section-card {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 1.5rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .account-page {
    padding: 1rem;
    gap: 1rem;
  }
  
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
```
