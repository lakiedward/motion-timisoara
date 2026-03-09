# 🎨 CORE Tokens & Design System

Acest fișier definește variabilele fundamentale. Orice stil nou **TREBUIE** să folosească aceste variabile.

---

## Variabile CSS Globale (`:root`)

Definite în `src/styles.css`. **NU le redefiniți în componente!**

### Culori Brand

| Variabilă | HEX | Utilizare |
| :--- | :--- | :--- |
| `--sport-primary` | `#2563eb` | Brand Primary (Blue) |
| `--sport-primary-dark` | `#1d4ed8` | Hover states |
| `--sport-secondary` | `#0ea5e9` | Sky Blue (Gradiente) |
| `--sport-accent` | `#f59e0b` | Amber (Admin icons, borders) |
| `--sport-accent-dark` | `#b45309` | Text accesibil pe fundal deschis |

### Culori Text

| Variabilă | HEX | Utilizare |
| :--- | :--- | :--- |
| `--sport-text-dark` | `#0f172a` | Titluri, text principal |
| `--sport-text-muted` | `#64748b` | Subtitluri, labels |
| `--sport-text-light` | `#94a3b8` | Placeholder, disabled |

### Culori Background

| Variabilă | HEX | Utilizare |
| :--- | :--- | :--- |
| `--sport-bg-light` | `#f8fafc` | Fundal pagini Admin/Account |
| `--sport-bg-white` | `#ffffff` | Carduri, modals |
| `--color-border-subtle` | `rgba(0,0,0,0.06)` | Borders discrete |

### Culori Status

| Variabilă | Scop |
| :--- | :--- |
| `--color-success` | `#22c55e` - Green |
| `--color-warning` | `#f59e0b` - Amber |
| `--color-error` | `#ef4444` - Red |
| `--color-info` | `#3b82f6` - Blue |

---

## Gradiente

```css
/* Primary - Blue to Sky */
--gradient-primary: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);

/* Warm - Amber (pentru Admin) */
--gradient-warm: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);

/* Green - pentru Coach */
--gradient-green: linear-gradient(135deg, #10b981 0%, #34d399 100%);

/* Mixed - Blue to Amber (table headers) */
--gradient-mixed: linear-gradient(90deg, #2563eb 0%, #f59e0b 100%);
```

---

## Typography

### Font Families
```css
--font-display: 'Manrope', sans-serif;  /* Titluri */
--font-primary: 'Inter', sans-serif;    /* Body text */
```

### Font Sizes

| Element | Size | Weight |
| :--- | :--- | :--- |
| Hero Title (Desktop) | `clamp(2.5rem, 5vw, 3.5rem)` | 800 |
| Hero Title (Mobile) | `clamp(1.75rem, 4vw, 2.25rem)` | 800 |
| Section Title | `clamp(2rem, 4vw, 2.75rem)` | 800 |
| Card Title | `1.125rem - 1.25rem` | 700 |
| Body Text | `1rem` | 400 |
| Small/Label | `0.875rem` | 500-600 |
| Badge | `0.75rem` | 700, uppercase |

### Letter Spacing
- **Titluri:** `-0.02em` (strânse)
- **Badges/Labels:** `0.05em` (spațiate, uppercase)

---

## Spacing System

```css
/* Base: 4px */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Container Widths
- **Max Width:** `1280px`
- **Padding:** `0 1.5rem` (Desktop), `0 1rem` (Mobile)

---

## Border Radius

```css
--radius-sm: 8px;      /* Inputs, small buttons */
--radius-md: 12px;     /* Medium components */
--radius-lg: 16px;     /* Stat icons */
--radius-card: 24px;   /* Cards, sections */
--radius-btn: 50px;    /* Pill buttons */
--radius-full: 9999px; /* Circles, badges */
```

---

## Shadows

```css
/* Card shadows */
--shadow-card: 0 4px 20px rgba(0, 0, 0, 0.08);
--shadow-card-hover: 0 12px 30px rgba(37, 99, 235, 0.15);

/* Elevations */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.12);

/* Button shadows */
--shadow-btn-primary: 0 4px 15px rgba(37, 99, 235, 0.3);
--shadow-btn-warm: 0 4px 15px rgba(245, 158, 11, 0.3);
--shadow-btn-green: 0 4px 15px rgba(16, 185, 129, 0.3);
```

---

## Z-Index Scale

```css
--z-base: 0;
--z-dropdown: 50;
--z-sticky: 100;
--z-fixed: 200;
--z-modal-backdrop: 250;
--z-modal: 300;
--z-popover: 350;
--z-toast: 400;
--z-tooltip: 500;
```

---

## Transitions

```css
--transition-fast: 0.2s ease;
--transition-normal: 0.3s ease;
--transition-smooth: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Breakpoints

| Name | Value | Usage |
| :--- | :--- | :--- |
| `xs` | `480px` | Very small phones |
| `sm` | `640px` | Small tablets |
| `md` | `768px` | Tablets |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Large desktop |

```scss
// SCSS mixins
@media (max-width: 768px) { /* Mobile */ }
@media (max-width: 1024px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## ⚠️ Reguli Stricte

1. **NU hardcodați culori** - Folosiți variabilele CSS
2. **NU redefiniți variabilele** în componente
3. **Folosiți `clamp()`** pentru font-size responsive
4. **Respectați spacing-ul** - Multipli de 4px
