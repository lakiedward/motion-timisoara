# 🏢 CLUB Page Patterns (`/club/*`)

## ⚠️ Context

Paginile Club sunt pentru **administratorii de club** - un rol intermediar între Coach și Admin.

Tema: **BLUE cu accente Purple/Indigo**.

---

## Diferențe față de Admin/Coach

| Element | Admin | Coach | Club |
| :--- | :--- | :--- | :--- |
| **Primary Color** | Amber | Emerald | Indigo |
| **Badge** | `badge--warning` | `badge--coach` | `badge--club` |
| **Hero Gradient End** | `#fffbeb` (Amber) | `#ecfdf5` (Green) | `#eef2ff` (Indigo) |
| **Button Gradient** | Amber | Green | Indigo |
| **Title Span** | `#f59e0b` | `#10b981` | `#6366f1` |

---

## Tema Culorilor Club

| Element | Valoare |
| :--- | :--- |
| **Primary** | `#6366f1` (Indigo 500) |
| **Primary Dark** | `#4f46e5` (Indigo 600) |
| **Light Tint** | `#eef2ff` (Indigo 50) |
| **Gradient** | `linear-gradient(135deg, #6366f1 0%, #818cf8 100%)` |
| **Shadow** | `0 4px 15px rgba(99, 102, 241, 0.3)` |

---

## 1. Page Hero Club

### Hero Gradient
```scss
background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #eef2ff 100%);
```

### SCSS Complet
```scss
.page-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.5rem;
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #eef2ff 100%);
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
    background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
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
    color: #6366f1; // INDIGO pentru Club
  }
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
  border: none;
  border-radius: var(--radius-btn, 50px);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  position: relative;
  z-index: 1;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
  }
}
```

---

## 2. Badge Club

```scss
.badge--club {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #3730a3;
  border: 1px solid #6366f1;
}
```

### HTML
```html
<span class="badge badge--club">Club Manager</span>
```

---

## 3. Structura Paginii Club

```
┌─────────────────────────────────────────┐
│  PAGE HERO (Indigo Theme)               │
│  Badge "Club Manager" + Title + Action  │
└─────────────────────────────────────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐
│ Stat 1   │  │ Stat 2   │  │ Stat 3   │
│ (Indigo) │  │ (Blue)   │  │ (Green)  │
└──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────────────┐
│  SECTION CARD                           │
│  Content: Antrenori, Locații, Cursuri   │
└─────────────────────────────────────────┘
```

---

## 4. Pagini Club Specifice

### Dashboard (`/club`)
- Statistici club (antrenori, cursuri, locații)
- Quick actions pentru management

### Antrenori (`/club/coaches`)
- Lista antrenorilor din club
- Invitare antrenori noi

### Locații (`/club/locations`)
- Gestionare locații antrenament
- Adăugare/editare locații

### Cursuri (`/club/courses`)
- Toate cursurile clubului
- Creare cursuri noi

### Anunțuri (`/club/announcements`)
- Anunțuri la nivel de club
- Trimitere notificări

---

## 5. Stat Icon pentru Club

```scss
.stat-icon--indigo {
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
}
```

---

## ✅ Checklist pentru Pagini Club

- [ ] Hero gradient are tint indigo la final (`#eef2ff`)?
- [ ] Element decorativ `::before` are rgba indigo?
- [ ] Badge este `badge--club`?
- [ ] Butonul principal are gradient indigo?
- [ ] Title span are culoare `#6366f1`?
- [ ] Shadows pe butoane au rgba indigo?

---

## Template SCSS Club (Copy-Paste)

```scss
// ============================================
// CLUB PAGE - INDIGO THEME
// ============================================

:host {
  display: block;
}

.club-page {
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
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #eef2ff 100%);
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
    background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
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
    color: #6366f1; // INDIGO for Club
  }
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
  border: none;
  border-radius: var(--radius-btn, 50px);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  position: relative;
  z-index: 1;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
  }
}

.badge--club {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #3730a3;
  border: 1px solid #6366f1;
}
```
