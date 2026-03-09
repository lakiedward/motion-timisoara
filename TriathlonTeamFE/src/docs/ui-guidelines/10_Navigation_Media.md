# 🧭 Navigation & Media

Ghid pentru navigație, breadcrumbs, avatare și imagini.

---

## Header / Navbar

### Dimensiuni

| Proprietate | Desktop | Mobile |
| :--- | :--- | :--- |
| **Height** | `80px` | `64px` |
| **Logo Height** | `40px` | `32px` |
| **Container Max-Width** | `1280px` | `100%` |
| **Container Padding** | `0 1.5rem` | `0 0.75rem` |

### Structura Desktop
```
┌────────────────────────────────────────────────────────────┐
│ [Logo] [Acasă] [Programe▼] [Hartă] [Antrenori] [Despre▼]   │
│                                    [Contul meu▼] [Avatar▼] │
└────────────────────────────────────────────────────────────┘
```

### Structura Mobile
```
┌────────────────────────────────────────────────────────────┐
│ [☰]  [Logo]                                    [Cont/Avatar]│
└────────────────────────────────────────────────────────────┘
```

### Comportament
- **Sticky** cu `position: fixed`
- **Glassmorphism** la scroll (optional)
- **Dropdowns** pe desktop, drawer pe mobile
- **Active state** pentru link-ul curent

### CSS
```scss
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-sticky);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-border-subtle);
}

.header__container {
  max-width: 1280px;
  margin: 0 auto;
  height: 80px;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

---

## Dropdowns

### Structură HTML
```html
<div class="nav-dropdown" 
     (mouseenter)="openDropdown('programs')"
     (mouseleave)="closeDropdown()">
  <button class="nav-dropdown__trigger">
    Programe
    <mat-icon>expand_more</mat-icon>
  </button>
  <div class="nav-dropdown__menu" [class.open]="activeDropdown === 'programs'">
    <a class="nav-dropdown__item" routerLink="/cursuri">
      <mat-icon>school</mat-icon>
      <span>Cursuri</span>
    </a>
    <!-- ... -->
  </div>
</div>
```

### Stiluri
```scss
.nav-dropdown {
  position: relative;

  &__trigger {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    font-weight: 500;
    cursor: pointer;
    
    &:hover {
      color: var(--sport-primary);
    }
  }

  &__menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 200px;
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    padding: 0.5rem;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.2s ease;

    &.open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    color: var(--sport-text-dark);
    text-decoration: none;
    
    &:hover {
      background: var(--sport-bg-light);
      color: var(--sport-primary);
    }
  }
}
```

---

## Mobile Drawer

### Structură
```html
<!-- Overlay -->
<div class="mobile-overlay" 
     [class.active]="isDrawerOpen"
     (click)="closeDrawer()">
</div>

<!-- Drawer -->
<aside class="mobile-drawer" [class.open]="isDrawerOpen">
  <div class="drawer-header">
    <img src="/ui/logo.png" alt="Motion" />
    <span>Motion Timișoara</span>
    <button (click)="closeDrawer()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <nav class="drawer-nav">
    <a routerLink="/" (click)="closeDrawer()">Acasă</a>
    
    <div class="drawer-section">PROGRAME</div>
    <a routerLink="/cursuri">Cursuri</a>
    <a routerLink="/tabere">Tabere</a>
    
    <!-- Role-based sections -->
    @if (isLoggedIn) {
      <div class="drawer-section">CONTUL MEU</div>
      <a routerLink="/account">Dashboard</a>
    }
  </nav>

  <div class="drawer-footer">
    @if (isLoggedIn) {
      <button (click)="logout()">Deconectare</button>
    } @else {
      <a routerLink="/login">Autentificare</a>
      <a routerLink="/register" class="primary">Creează cont</a>
    }
  </div>
</aside>
```

### Stiluri
```scss
.mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: calc(var(--z-modal) - 1);
  opacity: 0;
  transition: opacity 0.3s ease;

  @media (max-width: 768px) {
    display: block;
    pointer-events: none;

    &.active {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.mobile-drawer {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(320px, 85vw);
  background: white;
  z-index: var(--z-modal);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  overflow-y: auto;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;

    &.open {
      transform: translateX(0);
    }
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.drawer-section {
  padding: 0.75rem 1rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sport-text-muted);
}

.drawer-nav a {
  display: block;
  padding: 0.75rem 1rem;
  color: var(--sport-text-dark);
  text-decoration: none;

  &:hover, &.active {
    background: var(--sport-bg-light);
    color: var(--sport-primary);
  }
}
```

---

## Breadcrumbs

### Când se folosesc
- Pagini cu navigare ierarhică adâncă
- Exemple: `/admin/courses/123/edit`, `/account/children/456`

### HTML
```html
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a routerLink="/admin">Admin</a>
  <span class="separator">/</span>
  <a routerLink="/admin/courses">Cursuri</a>
  <span class="separator">/</span>
  <span class="current">Editare</span>
</nav>
```

### Stiluri
```scss
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;

  a {
    color: var(--sport-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--sport-primary);
    }
  }

  .separator {
    color: var(--sport-text-light);
  }

  .current {
    color: var(--sport-text-dark);
    font-weight: 500;
  }
}
```

---

## Avatare

### Dimensiuni

| Size | Class | Dimensiune |
| :--- | :--- | :--- |
| XS | `.avatar--xs` | 24px |
| SM | `.avatar--sm` | 32px |
| MD | `.avatar--md` | 48px |
| LG | `.avatar--lg` | 64px |
| XL | `.avatar--xl` | 96px |

### Structură
```html
<!-- Cu imagine -->
<div class="avatar avatar--md">
  <img [src]="user.photoUrl" [alt]="user.name" />
</div>

<!-- Fallback cu inițiale -->
<div class="avatar avatar--md avatar--initials">
  {{ getInitials(user.name) }}
</div>

<!-- Cu status indicator -->
<div class="avatar avatar--md">
  <img [src]="user.photoUrl" [alt]="user.name" />
  <span class="avatar__status avatar__status--online"></span>
</div>
```

### Stiluri
```scss
.avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &--xs { width: 24px; height: 24px; font-size: 0.625rem; }
  &--sm { width: 32px; height: 32px; font-size: 0.75rem; }
  &--md { width: 48px; height: 48px; font-size: 1rem; }
  &--lg { width: 64px; height: 64px; font-size: 1.25rem; }
  &--xl { width: 96px; height: 96px; font-size: 1.75rem; }

  &--initials {
    background: var(--gradient-primary);
    color: white;
    font-weight: 600;
    font-family: var(--font-primary);
  }

  &__status {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;

    &--online { background: #22c55e; }
    &--offline { background: #94a3b8; }
    &--busy { background: #ef4444; }
  }
}
```

### Funcție pentru Inițiale
```typescript
getInitials(name: string): string {
  if (!name) return '?';
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
```

---

## Imagini

### Aspect Ratios

| Tip | Ratio | Utilizare |
| :--- | :--- | :--- |
| Hero | 16:9 | Bannere, hero images |
| Card | 4:3 | Course cards, previews |
| Thumbnail | 1:1 | Avatare, galerii |
| Portrait | 3:4 | Profile photos |

### Responsive Images
```html
<div class="image-container image-container--16-9">
  <img 
    [src]="imageUrl" 
    [alt]="imageAlt"
    loading="lazy"
  />
</div>
```

```scss
.image-container {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &--16-9 { aspect-ratio: 16 / 9; }
  &--4-3 { aspect-ratio: 4 / 3; }
  &--1-1 { aspect-ratio: 1 / 1; }
  &--3-4 { aspect-ratio: 3 / 4; }
}
```

### Image Skeleton (Loading)
```html
@if (isLoading) {
  <div class="image-skeleton"></div>
} @else {
  <img [src]="url" />
}
```

```scss
.image-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## Galerie de Imagini

### Grid Gallery
```html
<div class="gallery-grid">
  @for (image of images; track image.id) {
    <button class="gallery-item" (click)="openLightbox(image)">
      <img [src]="image.thumbnailUrl" [alt]="image.alt" />
    </button>
  }
</div>
```

```scss
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.gallery-item {
  aspect-ratio: 1;
  border: none;
  padding: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
```
