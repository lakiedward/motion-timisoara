# Header Architecture - Motion Timișoara

## Principiu: Single Source of Truth

Un singur component de header care se adaptează la context, nu mai multe headere diferite.

---

## 1. User Roles & Contexts

| Role | Context | Acces |
|------|---------|-------|
| **Guest** | Public | Browsing cursuri, tabere, despre |
| **Parent** | Account | Dashboard, copii, înscrieri, plăți |
| **Coach** | Coach Panel | Cursurile mele, prezențe, program |
| **Admin** | Admin Panel | Management complet |

---

## 2. Header Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  [Logo]  [Context Badge]  │  [Navigation]  │  [Actions]  [User Menu]        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     ▲          ▲                   ▲               ▲            ▲
     │          │                   │               │            │
   Fixed    Conditional         Dynamic         Optional      Always
```

### 2.1 Logo Zone (Left)
- **Logo Image/Icon** - Întotdeauna vizibil
- **Brand Name** - "Motion Timișoara" (hidden on mobile)
- **Click** → Navighează la home-ul contextului:
  - Guest/Parent → `/`
  - Coach → `/coach`
  - Admin → `/admin`

### 2.2 Context Badge (Optional)
Apare doar când NU ești pe site-ul public:

| Context | Badge | Color |
|---------|-------|-------|
| Public | - (none) | - |
| Account | 👤 Contul Meu | Blue subtle |
| Coach | 🏃 Coach Panel | Green |
| Admin | ⚙️ Admin | Amber/Orange |

### 2.3 Navigation Zone (Center/Flexible)
Se schimbă complet în funcție de context:

**Public Navigation:**
```
Acasă | Cursuri | Tabere | Activități | Antrenori | Contact | Despre
```

**Account Navigation:**
```
Dashboard | Copiii Mei | Înscrieri | Plăți | Setări
```

**Coach Navigation:**
```
Dashboard | Cursurile Mele | Prezențe | Program | Rapoarte
```

**Admin Navigation:**
```
Dashboard | Antrenori | Cursuri | Locații | Tabere | Plăți | Rapoarte | Setări
```

### 2.4 Actions Zone (Right, before user menu)
Acțiuni contextuale rapide:

| Context | Actions |
|---------|---------|
| Public (Guest) | [Autentificare] [Începe Acum - CTA] |
| Public (Logged) | [Notificări] |
| Account | [Notificări] |
| Coach | [+ Curs Nou] [Notificări] |
| Admin | [+ Quick Add] [Notificări] |

### 2.5 User Menu (Right, Always)
Dropdown consistent pentru toți utilizatorii autentificați:

```
┌─────────────────────────────┐
│ [Avatar] Nume Utilizator    │
│ email@example.com           │
├─────────────────────────────┤
│ 👤 Contul Meu               │
│ ⚙️ Setări                   │
├─────────────────────────────┤ ← Separator
│ 🏠 Site Public              │ ← Context Switch
│ 🏃 Coach Panel      (Coach) │ ← If role allows
│ ⚙️ Admin Panel      (Admin) │ ← If role allows
├─────────────────────────────┤
│ 🚪 Deconectare              │
└─────────────────────────────┘
```

---

## 3. Visual Design Tokens

### 3.1 Consistent Across All Contexts
```css
/* Base Header */
--header-height: 80px;
--header-bg: rgba(255, 255, 255, 0.7);
--header-blur: blur(12px);
--header-border: 1px solid rgba(255, 255, 255, 0.3);
--header-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
--header-z-index: var(--z-sticky); /* 100 */
--header-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### 3.2 Context Colors (Badge & Accents)
```css
/* Public - No special accent */
--context-public: transparent;

/* Account - Subtle blue */
--context-account-bg: rgba(37, 99, 235, 0.08);
--context-account-text: var(--sport-primary);
--context-account-border: rgba(37, 99, 235, 0.15);

/* Coach - Green */
--context-coach-bg: rgba(16, 185, 129, 0.08);
--context-coach-text: #059669;
--context-coach-border: rgba(16, 185, 129, 0.15);

/* Admin - Amber */
--context-admin-bg: rgba(245, 158, 11, 0.08);
--context-admin-text: var(--sport-accent-dark);
--context-admin-border: rgba(245, 158, 11, 0.15);
```

---

## 4. Component Architecture

### 4.1 Folder Structure
```
src/app/core/components/
├── header/
│   ├── header.component.ts          # Main orchestrator
│   ├── header.component.html
│   ├── header.component.scss
│   ├── header-logo/                  # Logo + brand
│   ├── header-nav/                   # Navigation links
│   ├── header-actions/               # Quick actions
│   ├── header-user-menu/             # User dropdown
│   └── header-context-badge/         # Context indicator
```

### 4.2 Header Component Logic
```typescript
// header.component.ts
interface HeaderContext {
  type: 'public' | 'account' | 'coach' | 'admin';
  navigation: NavItem[];
  actions: ActionItem[];
  badge?: ContextBadge;
}

// Determine context based on route
private getContext(): HeaderContext {
  const url = this.router.url;
  
  if (url.startsWith('/admin')) {
    return this.adminContext;
  } else if (url.startsWith('/coach')) {
    return this.coachContext;
  } else if (url.startsWith('/account')) {
    return this.accountContext;
  }
  return this.publicContext;
}
```

### 4.3 Navigation Data
```typescript
// Public navigation
publicNav: NavItem[] = [
  { path: '/', label: 'Acasă', exact: true },
  { path: '/cursuri', label: 'Cursuri' },
  { path: '/tabere', label: 'Tabere' },
  { path: '/activitati', label: 'Activități' },
  { path: '/antrenori', label: 'Antrenori' },
  { path: '/contact', label: 'Contact' },
  { path: '/despre', label: 'Despre' },
];

// Admin navigation
adminNav: NavItem[] = [
  { path: '/admin', label: 'Dashboard', exact: true, icon: 'dashboard' },
  { path: '/admin/coaches', label: 'Antrenori', icon: 'people' },
  { path: '/admin/courses', label: 'Cursuri', icon: 'school' },
  { path: '/admin/locations', label: 'Locații', icon: 'location_on' },
  { path: '/admin/camps', label: 'Tabere', icon: 'camping' },
  { path: '/admin/payments', label: 'Plăți', icon: 'payments' },
  { path: '/admin/reports', label: 'Rapoarte', icon: 'analytics' },
];
```

---

## 5. Responsive Behavior

### 5.1 Breakpoints
| Breakpoint | Behavior |
|------------|----------|
| **≥1280px** | Full header, all navigation visible |
| **1024-1279px** | Condensed nav, some items in "More" dropdown |
| **768-1023px** | Logo + Context Badge + User Menu + Hamburger |
| **<768px** | Logo + User Avatar + Hamburger (mobile menu) |

### 5.2 Mobile Menu Structure
```
┌─────────────────────────────────┐
│ [Logo]              [×] Close   │
├─────────────────────────────────┤
│ [Avatar] Nume                   │
│ email@example.com               │
│ [Context Badge: Admin Panel]    │
├─────────────────────────────────┤
│ Navigation Links                │
│ ├─ Dashboard                    │
│ ├─ Antrenori                    │
│ ├─ Cursuri                      │
│ └─ ...                          │
├─────────────────────────────────┤
│ Switch Context                  │
│ ├─ 🏠 Site Public               │
│ ├─ 👤 Contul Meu                │
│ └─ 🏃 Coach Panel               │
├─────────────────────────────────┤
│ [Deconectare]                   │
└─────────────────────────────────┘
```

---

## 6. Transitions Between Contexts

Când utilizatorul schimbă contextul (ex: Public → Admin):

1. **Logo** - Rămâne fix
2. **Context Badge** - Fade in/out cu slide
3. **Navigation** - Crossfade cu noul set de link-uri
4. **User Menu** - Rămâne identic

```css
/* Smooth context transition */
.header-nav {
  transition: opacity 0.2s ease-out;
}

.context-badge {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.context-badge-enter {
  opacity: 0;
  transform: translateX(-10px);
}

.context-badge-enter-active {
  opacity: 1;
  transform: translateX(0);
}
```

---

## 7. Implementation Priority

### Phase 1: Unify Headers
1. [ ] Create unified `HeaderComponent` with context detection
2. [ ] Move admin-specific header logic into header context
3. [ ] Remove `admin-layout` header, use unified header
4. [ ] Test all contexts work correctly

### Phase 2: Polish
1. [ ] Add context badge component
2. [ ] Implement smooth transitions between contexts
3. [ ] Add notification system placeholder
4. [ ] Optimize mobile menu

### Phase 3: Advanced
1. [ ] Add keyboard navigation (a11y)
2. [ ] Add search functionality (global search)
3. [ ] Add recent items in user dropdown
4. [ ] Add quick actions based on context

---

## 8. Examples from Production Sites

| Site | Approach | What We Can Learn |
|------|----------|-------------------|
| **GitHub** | Same header everywhere, context in breadcrumbs | Consistency builds trust |
| **Notion** | Minimal header, workspace switcher | Clean, focused |
| **Shopify** | Separate admin subdomain | Clear separation |
| **Google Workspace** | App switcher in header | Easy context switch |
| **Slack** | Workspace name in header | Clear context indicator |

### Our Approach: GitHub + Slack Hybrid
- Single header like GitHub
- Context badge like Slack's workspace indicator
- Role-based dropdown like Google Workspace

---

## 9. Migration Path

### Current:
```
header.component (public)  ─────► Public pages
admin-layout.component ─────────► Admin pages (has its own header)
```

### Target:
```
unified-header.component ─────► ALL pages
  ├─ detects context from route
  ├─ loads appropriate navigation
  ├─ shows context badge if not public
  └─ maintains consistent UX
```

### Steps:
1. Create new `unified-header` component
2. Test alongside existing headers
3. Gradually migrate routes to use unified header
4. Remove old header components
5. Rename `unified-header` to `header`

---

## 10. Success Metrics

- [ ] Single header component for all contexts
- [ ] Context switching < 300ms transition
- [ ] Mobile menu works on all contexts
- [ ] User always knows where they are (context badge)
- [ ] Easy navigation back to public site
- [ ] Consistent styling (glassmorphism, 80px height)
- [ ] WCAG AA accessible
