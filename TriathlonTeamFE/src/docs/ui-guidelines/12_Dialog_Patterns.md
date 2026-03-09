# 💬 Dialog Patterns

Pattern-uri pentru dialoguri și modale în aplicație.

---

## Tipuri de Dialoguri

| Tip | Utilizare | Culoare Accent |
|:----|:----------|:---------------|
| **Confirmare** | Acțiuni ireversibile (delete) | Zona curentă |
| **Danger** | Force delete, acțiuni cu impact mare | Roșu (#ef4444) |
| **Form Dialog** | Edit inline, create rapid | Zona curentă |
| **Info Dialog** | Mesaje informative | Albastru (#3b82f6) |

---

## Structura Dialog

```html
<div class="premium-dialog">
  <!-- Header -->
  <div class="dialog-header">
    <div class="icon-container">
      <mat-icon class="warning-icon">warning_amber</mat-icon>
    </div>
    <div class="header-content">
      <h2 mat-dialog-title>Titlu Dialog</h2>
      <p class="header-subtitle">Subtitlu sau context</p>
    </div>
  </div>
  
  <!-- Content -->
  <mat-dialog-content class="dialog-content">
    <div class="info-card warning-card">
      <!-- Card content -->
    </div>
    <div class="alert-banner">
      <!-- Warning message -->
    </div>
  </mat-dialog-content>
  
  <!-- Actions -->
  <mat-dialog-actions class="dialog-actions">
    <button class="cancel-btn">Renunță</button>
    <button class="confirm-btn">Confirmă</button>
  </mat-dialog-actions>
</div>
```

---

## Culori pe Zone

### Admin Zone (Amber)
```css
/* Normal confirmation */
--dialog-accent: var(--sport-accent); /* #f59e0b */
--dialog-accent-light: #fffbeb;
--dialog-accent-border: rgba(245, 158, 11, 0.2);

/* Danger/Force delete */
--dialog-danger: #ef4444;
--dialog-danger-light: #fef2f2;
--dialog-danger-border: rgba(239, 68, 68, 0.2);
```

### Account Zone (Blue)
```css
--dialog-accent: var(--sport-primary); /* #2563eb */
--dialog-accent-light: #eff6ff;
--dialog-accent-border: rgba(37, 99, 235, 0.2);
```

### Coach Zone (Green)
```css
--dialog-accent: #10b981;
--dialog-accent-light: #ecfdf5;
--dialog-accent-border: rgba(16, 185, 129, 0.2);
```

---

## Stiluri CSS Obligatorii

### Container Dialog
```css
:host ::ng-deep .mat-mdc-dialog-container {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(24px) !important;
  border-radius: var(--radius-card) !important; /* 24px */
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12) !important;
  border: 1px solid var(--dialog-accent-border) !important;
  padding: 0 !important;
  max-height: 90vh !important;
  overflow-y: auto !important;
}
```

### Header cu Icon
```css
.dialog-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.icon-container {
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    inset: -6px;
    background: linear-gradient(135deg, var(--dialog-accent-light) 0%, white 100%);
    border-radius: 50%;
    opacity: 0.7;
    animation: pulse 2s ease-in-out infinite;
  }
}

.warning-icon {
  font-size: 2.5rem !important;
  color: var(--dialog-accent);
  background: linear-gradient(135deg, var(--dialog-accent-light) 0%, white 100%);
  border-radius: 50%;
  padding: 0.75rem;
  box-shadow: 0 6px 20px rgba(var(--dialog-accent-rgb), 0.25);
  border: 2px solid var(--dialog-accent-border);
}
```

### Info Cards
```css
.info-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-md); /* 12px */
  margin-bottom: 1rem;
  border: 2px solid transparent;
}

.warning-card {
  background: linear-gradient(135deg, var(--dialog-accent-light) 0%, white 100%);
  border-color: var(--dialog-accent-border);
}

.danger-card {
  background: linear-gradient(135deg, var(--dialog-danger-light) 0%, white 100%);
  border-color: var(--dialog-danger-border);
}
```

### Alert Banner
```css
.alert-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, var(--dialog-accent-light) 0%, white 100%);
  border-radius: var(--radius-sm); /* 8px */
  border: 2px solid var(--dialog-accent-border);
  
  mat-icon {
    color: var(--dialog-accent);
  }
  
  span {
    font-weight: 600;
    
    strong {
      font-weight: 800;
      color: var(--dialog-accent);
    }
  }
}
```

### Action Buttons
```css
.dialog-actions {
  padding: 1.5rem 0 0 !important;
  margin: 0 !important;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 2px solid var(--color-border-subtle);
  
  @media (max-width: 640px) {
    flex-direction: column-reverse;
  }
}

.cancel-btn {
  border: 2px solid var(--blue-100) !important;
  color: var(--sport-text-muted) !important;
  background: var(--sport-bg-light) !important;
  
  &:hover {
    border-color: var(--sport-primary) !important;
    color: var(--sport-primary) !important;
    transform: translateY(-2px);
  }
}

.confirm-btn {
  background: linear-gradient(135deg, var(--dialog-accent) 0%, var(--dialog-accent-dark) 100%) !important;
  color: white !important;
  box-shadow: 0 4px 16px rgba(var(--dialog-accent-rgb), 0.3) !important;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(var(--dialog-accent-rgb), 0.4) !important;
  }
}

/* Pentru Danger/Force Delete */
.force-btn {
  background: linear-gradient(135deg, var(--dialog-danger) 0%, #dc2626 100%) !important;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3) !important;
}
```

---

## Responsive

```css
.premium-dialog {
  min-width: 480px;
  max-width: 560px;
  padding: 2rem;
  
  @media (max-width: 640px) {
    min-width: auto;
    width: calc(100vw - 2rem);
    padding: 1.5rem;
  }
}

.dialog-actions button {
  min-width: 140px;
  height: 48px;
  
  @media (max-width: 640px) {
    width: 100%;
  }
}
```

---

## Animații

```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 0.9; }
}

.dialog-header {
  animation: fadeInDown 0.5s ease;
}

.dialog-content {
  animation: fadeIn 0.6s ease 0.1s backwards;
}

.dialog-actions {
  animation: fadeInUp 0.6s ease 0.2s backwards;
}
```

---

## Deschidere Dialog în Angular

```typescript
import { MatDialog } from '@angular/material/dialog';

// În component
private readonly dialog = inject(MatDialog);

openDeleteDialog(): void {
  const dialogRef = this.dialog.open(DeleteDialogComponent, {
    data: { ... },
    panelClass: 'premium-dialog-panel',
    disableClose: true
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result?.confirmed) {
      // Handle confirmation
    }
  });
}
```

---

## Checklist Implementare

- [ ] Container folosește `backdrop-filter: blur(24px)`
- [ ] Border-radius este `var(--radius-card)` (24px)
- [ ] Header are icon cu efect pulse
- [ ] Info card are gradient subtle
- [ ] Alert banner pentru mesaje importante
- [ ] Butoane au gradient și shadow
- [ ] Responsive pe mobile (stack vertical)
- [ ] Animații fadeIn pentru intrare
- [ ] `disableClose: true` pentru dialoguri importante
