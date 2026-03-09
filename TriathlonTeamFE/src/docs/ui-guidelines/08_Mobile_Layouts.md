# 📱 Mobile Design Guidelines

Reguli pentru ecrane `< 768px`.

---

## Reguli de Aur

### 1. Touch Targets
- **Minimum:** 44x44px pentru orice element interactiv
- Butoane, link-uri, iconuri clickable

### 2. Spacing Reduction
- Desktop spacing × **0.5-0.7** pe mobile
- Section spacing: `6rem` → `3rem-4rem`
- Grid gap: `2rem` → `1rem`
- Padding: `2rem` → `1rem-1.5rem`

### 3. Typography Scaling
| Element | Desktop | Mobile |
| :--- | :--- | :--- |
| Hero Title | `3rem` | `1.75rem-2rem` |
| Section Title | `2.5rem` | `1.5rem` |
| Card Title | `1.25rem` | `1.125rem` |
| Body | `1rem` | `0.875rem-1rem` |

### 4. Column Changes
| Component | Desktop | Mobile |
| :--- | :--- | :--- |
| Stats Cards | 3 columns | 1 column |
| Entity Grid | 3 columns | 1 column |
| Form Grid | 2 columns | 1 column |
| Media Grid | 4 columns | 2 columns |

---

## Header Mobile

### Dimensiuni
| Proprietate | Desktop | Mobile |
| :--- | :--- | :--- |
| **Header Height** | `80px` | `64px` |
| **Logo** | `40px` | `32px` |
| **Container Padding** | `0 1.5rem` | `0 0.75rem` |

### Comportament
```scss
$header-height: 80px;
$header-height-mobile: 64px;

.header__container {
  height: $header-height;
  
  @media (max-width: 768px) {
    height: $header-height-mobile;
    padding: 0 0.75rem;
  }
}
```

### Navigare Mobile
- **Dropdowns:** Ascunse pe mobile
- **Hamburger Menu:** Visible doar pe mobile
- **Mobile Drawer:** Pentru toată navigarea
- **Login Button:** Text "Cont" în loc de icon

```scss
.header__right {
  @media (max-width: 768px) {
    .nav-dropdown {
      display: none !important;
    }
  }
}

.mobile-login-btn {
  display: none;
  
  @media (max-width: 768px) {
    display: flex;
  }
}
```

---

## Page Hero Mobile

### Ajustări
```scss
@media (max-width: 768px) {
  .page-hero {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
    gap: 1rem;
  }

  .hero-title {
    font-size: clamp(1.5rem, 5vw, 2rem);
  }

  .hero-btn {
    width: 100%;
    justify-content: center;
  }
}
```

### Global Override (în `styles.css`)
```css
@media (max-width: 768px) {
  .page-hero,
  section.page-hero,
  [class*="page-hero"] {
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
  }

  .page-hero__title {
    font-size: 1.5rem !important;
  }
}
```

---

## Stats Row Mobile

```scss
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stat-card {
    padding: 1.25rem;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }

  .stat-number {
    font-size: 1.5rem;
  }
}
```

---

## Cards Grid Mobile

```scss
@media (max-width: 768px) {
  .entity-grid,
  .cards-grid,
  .activities-grid {
    grid-template-columns: 1fr;
  }

  .entity-card,
  .activity-card {
    // Full width pe mobile
  }
}
```

---

## Section Card Mobile

```scss
@media (max-width: 768px) {
  .section-card {
    padding: 1.25rem;
    border-radius: 16px; // Slightly smaller
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .section-title {
    font-size: 1.125rem;
  }
}
```

---

## Forms Mobile

### Layout Changes
```scss
@media (max-width: 768px) {
  .form-section {
    padding: 1.25rem;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .form-actions {
    flex-direction: column;

    button {
      width: 100%;
      justify-content: center;
    }
  }
}
```

### Sticky Actions
```scss
@media (max-width: 768px) {
  .form-actions--sticky {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    background: var(--sport-bg-white);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    z-index: var(--z-sticky);
  }
}
```

---

## Tables Mobile

Transform tables în card-uri pe mobile:

```scss
@media (max-width: 640px) {
  .data-table {
    thead {
      display: none;
    }

    tbody, tr, td {
      display: block;
      width: 100%;
    }

    tr {
      margin-bottom: 1rem;
      padding: 1rem;
      background: var(--sport-bg-white);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-sm);
    }

    td {
      padding: 0.5rem 0;
      border: none;

      &::before {
        content: attr(data-label);
        display: block;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--sport-text-muted);
        margin-bottom: 0.25rem;
      }
    }
  }
}
```

---

## Modal/Dialog Mobile

```scss
@media (max-width: 768px) {
  .mat-mdc-dialog-container {
    max-width: 100vw !important;
    max-height: 100vh !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }

  .dialog-content {
    padding: 1rem;
  }

  .dialog-actions {
    flex-direction: column;
    gap: 0.5rem;

    button {
      width: 100%;
    }
  }
}
```

---

## Navigation Mobile (Drawer)

### Structure
```html
<aside class="mobile-drawer" [class.open]="isDrawerOpen()">
  <div class="drawer-header">
    <img src="/ui/logo.png" alt="Logo" />
    <button (click)="closeDrawer()">
      <mat-icon>close</mat-icon>
    </button>
  </div>
  
  <nav class="drawer-nav">
    <a routerLink="/">Acasă</a>
    <div class="drawer-section">PROGRAME</div>
    <a routerLink="/cursuri">Cursuri</a>
    <!-- ... -->
  </nav>
  
  <div class="drawer-footer">
    <a routerLink="/login">Autentificare</a>
  </div>
</aside>
```

### Sizing
- **Width:** `min(320px, 85vw)`
- **Overlay:** `rgba(0, 0, 0, 0.5)`
- **Animation:** `transform 0.3s ease`

---

## Bottom CTA Bar (pentru pagini de vânzare)

```scss
.bottom-cta {
  display: none;
  
  @media (max-width: 768px) {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    background: var(--sport-bg-white);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
    z-index: var(--z-sticky);
    gap: 0.75rem;

    button {
      flex: 1;
    }
  }
}
```

---

## ✅ Mobile Checklist

- [ ] **Touch targets** sunt minimum 44x44px?
- [ ] **Font sizes** sunt citibile (min 14px)?
- [ ] **Spacing** e redus proporțional?
- [ ] **Grid-uri** devin 1 coloană?
- [ ] **Navigarea** folosește drawer?
- [ ] **Forms** au actions sticky?
- [ ] **Tables** se transformă în carduri?
- [ ] **Modals** sunt full-screen?
- [ ] **Horizontal scroll** nu există?
- [ ] **Images** se redimensionează corect?

---

## Breakpoints Reference

```scss
// Mobile First
@media (min-width: 480px) { /* XS */ }
@media (min-width: 640px) { /* SM */ }
@media (min-width: 768px) { /* MD - Tablet */ }
@media (min-width: 1024px) { /* LG - Desktop */ }
@media (min-width: 1280px) { /* XL - Large */ }

// Desktop First (more common in this project)
@media (max-width: 1023px) { /* Tablet and below */ }
@media (max-width: 768px) { /* Mobile */ }
@media (max-width: 640px) { /* Small mobile */ }
@media (max-width: 480px) { /* Very small */ }
```
