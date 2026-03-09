# 🔘 Butoane & Badges

Componente de bază pentru acțiuni și indicatori.

---

## Butoane

### Primary Button (`.btn-elite--primary`)
```scss
.btn-elite--primary {
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-btn); // 50px - pill shape
  padding: 0.875rem 1.75rem;
  font-weight: 600;
  box-shadow: var(--shadow-btn-primary);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
  }
}
```

### Outline Button (`.btn-elite--outline`)
```scss
.btn-elite--outline {
  background: transparent;
  color: var(--sport-primary);
  border: 2px solid var(--sport-primary);
  border-radius: var(--radius-btn);
  
  &:hover {
    background: var(--sport-primary);
    color: white;
  }
}
```

### Hero Button (`.hero-btn`)
Folosit în page heroes - mai mare, cu shadow pronunțat.
```scss
.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: var(--radius-btn);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  
  mat-icon {
    font-size: 1.25rem;
    width: 1.25rem;
    height: 1.25rem;
  }
  
  &:hover {
    transform: translateY(-3px);
  }
}
```

### Variante Hero Button pe Zonă
```scss
// Admin - Amber
.hero-btn--admin {
  background: var(--gradient-warm);
  color: white;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
  
  &:hover { box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4); }
}

// Coach - Green
.hero-btn--coach {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
  
  &:hover { box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
}

// Club - Indigo
.hero-btn--club {
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  
  &:hover { box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4); }
}

// Public/Account - Blue
.hero-btn--primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-btn-primary);
  
  &:hover { box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4); }
}
```

### Icon Button (`.icon-btn`)
```scss
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  mat-icon {
    font-size: 1.25rem;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--sport-text-muted);
  }

  &:hover {
    background: var(--sport-bg-light);
    mat-icon { color: var(--sport-primary); }
  }

  &--danger:hover {
    background: #fef2f2;
    mat-icon { color: #ef4444; }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

### Toggle Button
```scss
.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 50px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--sport-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;

  mat-icon {
    font-size: 1rem;
    width: 1rem;
    height: 1rem;
  }

  &:hover {
    background: var(--sport-bg-light);
    border-color: var(--sport-primary);
    color: var(--sport-primary);
  }

  &--active:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
}
```

---

## Badges

```html
<span class="badge badge--warning">Administrare</span>
<span class="badge badge--success">Activ</span>
<span class="badge badge--neutral">Inactiv</span>
<span class="badge badge--error">Expirat</span>
<span class="badge badge--coach">Antrenor</span>
<span class="badge badge--club">Club</span>
```

### SCSS
```scss
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  // Admin
  &--warning {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
    border: 1px solid #f59e0b;
  }
  
  // Success
  &--success {
    background: linear-gradient(135deg, #dcfce7, #bbf7d0);
    color: #166534;
    border: 1px solid #22c55e;
  }
  
  // Error
  &--error {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    color: #b91c1c;
    border: 1px solid #ef4444;
  }
  
  // Neutral
  &--neutral {
    background: var(--sport-bg-light);
    color: var(--sport-text-muted);
    border: 1px solid #cbd5e1;
  }
  
  // Coach (Green)
  &--coach {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #065f46;
    border: 1px solid #10b981;
  }
  
  // Club (Indigo)
  &--club {
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    color: #3730a3;
    border: 1px solid #6366f1;
  }
  
  // Primary (Blue)
  &--primary {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    color: #1e40af;
    border: 1px solid #3b82f6;
  }
}
```

### Badge "Nou" (pentru anunțuri)
```scss
.badge--new {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
  border: 1px solid #f59e0b;
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
}
```

---

## Tags (pentru liste de sporturi, etc.)

```scss
.tag {
  padding: 0.25rem 0.5rem;
  background: var(--sport-bg-light);
  color: var(--sport-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
}
```
