# 🃏 Carduri

Toate tipurile de carduri folosite în aplicație.

---

## Card Standard

```scss
.card {
  background: var(--sport-bg-white);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card); // 24px
  box-shadow: var(--shadow-card);
  transition: var(--transition-smooth);
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-card-hover);
  }
}
```

---

## Section Card

Container pentru secțiuni de conținut.

```scss
.section-card {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 2rem;
  border: 1px solid var(--color-border-subtle);
}
```

---

## Stat Card

Pentru statistici în stats-row.

```html
<div class="stat-card">
  <div class="stat-icon stat-icon--blue">
    <mat-icon>event</mat-icon>
  </div>
  <div class="stat-info">
    <span class="stat-number">42</span>
    <span class="stat-label">Total</span>
  </div>
</div>
```

```scss
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

  &--blue { background: linear-gradient(135deg, #2563eb, #3b82f6); }
  &--green { background: linear-gradient(135deg, #22c55e, #4ade80); }
  &--amber { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
  &--indigo { background: linear-gradient(135deg, #6366f1, #818cf8); }
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

## Entity Card

Pattern universal pentru liste de entități (Admin/Coach/Club).

### ⚠️ REGULĂ IMPORTANTĂ

**TOATE butoanele de acțiune (edit, toggle, delete) sunt în HEADER, nu în footer!**

Footer conține DOAR statistici (fără butoane).

### Structura

```
┌─────────────────────────────────────┐
│ [Icon]           [✏️] [⚡] [🗑️]     │  ← Header (ACTIONS HERE!)
├─────────────────────────────────────┤
│ [Badge Status]                      │
│ Titlu Entitate                      │  ← Body
│ 📅 Data  |  📍 Locație              │
├─────────────────────────────────────┤
│ 👥 12/20  |  💰 150 RON             │  ← Footer (STATS ONLY!)
└─────────────────────────────────────┘
```

### HTML
```html
<article class="entity-card" [class.entity-card--inactive]="!item.active">
  <!-- HEADER: Icon + ALL Actions -->
  <div class="entity-card__header">
    <div class="entity-card__icon">
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

  <!-- BODY: Status + Name + Meta -->
  <div class="entity-card__body">
    <span class="badge badge--success">Activ</span>
    <h3 class="entity-card__title">{{ item.name }}</h3>
    <div class="entity-card__meta">
      <div class="meta-item">
        <mat-icon>calendar_today</mat-icon>
        <span>{{ item.date }}</span>
      </div>
    </div>
  </div>

  <!-- FOOTER: Stats ONLY (no buttons!) -->
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

### SCSS
```scss
.entity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.entity-card {
  display: flex;
  flex-direction: column;
  background: var(--sport-bg-white);
  border-radius: 20px;
  border: 1px solid var(--color-border-subtle);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
  }

  &--inactive { opacity: 0.7; }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1.25rem 1.25rem 0;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    
    mat-icon { color: white; font-size: 1.5rem; }

    &--default { background: linear-gradient(135deg, #2563eb, #3b82f6); }
    &--admin { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
    &--coach { background: linear-gradient(135deg, #10b981, #34d399); }
    &--club { background: linear-gradient(135deg, #6366f1, #818cf8); }
  }

  &__actions { display: flex; gap: 0.25rem; }

  &__body {
    padding: 1rem 1.25rem;
    flex: 1;
  }

  &__title {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sport-text-dark);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--sport-bg-light);
    border-top: 1px solid var(--color-border-subtle);
  }

  &__stats { display: flex; gap: 1rem; }
}

.stat-mini {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sport-text-dark);

  mat-icon {
    font-size: 1rem;
    color: var(--sport-text-muted);
  }

  &--highlight { color: var(--sport-primary); }
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--sport-text-muted);

  mat-icon {
    font-size: 1rem;
    color: var(--sport-primary);
  }
}

// ACTION BUTTONS - folosește aceste clase, NU icon-btn!
.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;

  mat-icon { font-size: 1.25rem; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &--edit {
    color: var(--sport-primary);
    &:hover:not(:disabled) { background: #eff6ff; }
  }
  &--toggle {
    color: var(--sport-text-muted);
    &:hover:not(:disabled) { background: #f1f5f9; }
    &.action-btn--active { color: #22c55e; }
  }
  &--delete {
    color: #ef4444;
    &:hover:not(:disabled) { background: #fef2f2; }
  }
}
```

---

## Entity Card cu Imagine

Pentru cursuri.

```scss
.entity-card--with-image {
  .entity-card__image {
    position: relative;
    aspect-ratio: 16/9;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    &:hover img { transform: scale(1.05); }
  }

  .entity-card__badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    padding: 0.25rem 0.75rem;
    background: var(--gradient-warm);
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: 50px;
  }
}
```

---

## Entity Card cu Avatar

Pentru antrenori/utilizatori.

```scss
.entity-card--with-avatar {
  .entity-card__avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: white;
    font-weight: 600;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  .entity-card__subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--sport-text-muted);
  }

  .entity-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.75rem;
  }
}
```

---

## Mobile

```scss
@media (max-width: 768px) {
  .entity-grid {
    grid-template-columns: 1fr;
  }

  .entity-card__footer {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;

    .toggle-btn {
      width: 100%;
      justify-content: center;
    }
  }
}
```
