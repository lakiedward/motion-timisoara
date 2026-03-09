# 📝 Form Patterns (Create/Edit Pages)

Pattern-uri pentru paginile de creare și editare (`/new`, `/edit`).

---

## Layout Standard Form

### Structură
```
┌─────────────────────────────────────────┐
│  HERO (Back Button + Title)             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SECTION CARD 1: Informații de Bază     │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ Input       │  │ Input       │       │
│  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SECTION CARD 2: Media                  │
│  ┌────────┐  ┌────────┐  ┌─ ─ ─ ─ ─┐   │
│  │ Photo  │  │ Photo  │  │ Upload  │   │
│  └────────┘  └────────┘  └─ ─ ─ ─ ─┘   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  FORM ACTIONS                           │
│           [Cancel]  [Save]              │
└─────────────────────────────────────────┘
```

---

## 1. Form Hero (cu Back Button)

### HTML
```html
<header class="form-hero">
  <button class="back-btn" (click)="goBack()">
    <mat-icon>arrow_back</mat-icon>
    <span>Înapoi</span>
  </button>
  <div class="hero-content">
    <span class="badge badge--warning">{{ isEdit ? 'Editare' : 'Creare' }}</span>
    <h1 class="hero-title">{{ isEdit ? 'Editează' : 'Adaugă' }} <span>Entitate</span></h1>
  </div>
</header>
```

### SCSS
```scss
.form-hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  background: linear-gradient(135deg, #eff6ff 0%, var(--sport-bg-light) 50%, #fffbeb 100%);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.back-btn {
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
  width: fit-content;

  mat-icon {
    font-size: 1.25rem;
    width: 1.25rem;
    height: 1.25rem;
  }

  &:hover {
    background: var(--sport-bg-white);
    border-color: var(--sport-primary);
    color: var(--sport-primary);
  }
}
```

---

## 2. Form Sections

### HTML
```html
<form [formGroup]="form" class="form-layout">
  <!-- Section 1 -->
  <section class="form-section">
    <h2 class="form-section__title">
      <mat-icon>info</mat-icon>
      Informații de Bază
    </h2>
    
    <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>Nume</mat-label>
        <input matInput formControlName="name" />
        <mat-error *ngIf="form.get('name')?.hasError('required')">
          Numele este obligatoriu
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Descriere</mat-label>
        <textarea matInput formControlName="description" rows="4"></textarea>
      </mat-form-field>
    </div>
  </section>

  <!-- Section 2: Media -->
  <section class="form-section">
    <h2 class="form-section__title">
      <mat-icon>photo_library</mat-icon>
      Imagini
    </h2>
    
    <div class="media-grid">
      <!-- Photos aici -->
    </div>
  </section>

  <!-- Form Actions -->
  <div class="form-actions">
    <button type="button" class="btn-secondary" (click)="cancel()">
      Anulează
    </button>
    <button type="submit" class="btn-primary" [disabled]="form.invalid || isSaving()">
      {{ isSaving() ? 'Se salvează...' : 'Salvează' }}
    </button>
  </div>
</form>
```

### SCSS
```scss
.form-layout {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 2rem;
  border: 1px solid var(--color-border-subtle);

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1.5rem;
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sport-text-dark);

    mat-icon {
      color: var(--sport-primary);
    }
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}
```

---

## 3. Input Styles

### Angular Material Customization
```scss
// În componenta form sau global
.mat-mdc-form-field {
  width: 100%;
}

.mat-mdc-text-field-wrapper {
  background: var(--sport-bg-white) !important;
  border-radius: 12px !important;
}

.mdc-text-field--outlined {
  .mdc-notched-outline__leading,
  .mdc-notched-outline__notch,
  .mdc-notched-outline__trailing {
    border-color: var(--color-border-subtle) !important;
  }

  &:hover .mdc-notched-outline {
    border-color: var(--sport-primary) !important;
  }
}

.mat-mdc-form-field.mat-focused {
  .mdc-notched-outline {
    border-color: var(--sport-primary) !important;
    border-width: 2px !important;
  }
}

// Input height
.mat-mdc-form-field-infix {
  min-height: 50px !important;
  padding: 0.75rem 0 !important;
}
```

### Dimensiuni Input
| Element | Înălțime | Radius |
| :--- | :--- | :--- |
| Text Input | 50px | 12px |
| Textarea | Auto (min 100px) | 12px |
| Select | 50px | 12px |
| Checkbox/Radio | 20px | 4px |

---

## 4. Media Grid (Upload)

### HTML
```html
<div class="media-grid">
  <!-- Existing Photos -->
  @for (photo of photos(); track photo.id) {
    <div class="media-card">
      <img [src]="photo.url" [alt]="photo.name" />
      <div class="media-card__overlay">
        <button class="icon-btn icon-btn--danger" (click)="removePhoto(photo)">
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    </div>
  }

  <!-- Upload Button -->
  @if (photos().length < maxPhotos) {
    <label class="upload-card">
      <input type="file" accept="image/*" (change)="onFileSelect($event)" hidden />
      <mat-icon>add_photo_alternate</mat-icon>
      <span>Adaugă imagine</span>
    </label>
  }
</div>
```

### SCSS
```scss
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.media-card {
  position: relative;
  aspect-ratio: 4/3;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover .media-card__overlay {
    opacity: 1;
  }
}

.upload-card {
  aspect-ratio: 4/3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--sport-bg-light);
  cursor: pointer;
  transition: all 0.2s ease;

  mat-icon {
    font-size: 2rem;
    width: 2rem;
    height: 2rem;
    color: var(--sport-text-muted);
  }

  span {
    font-size: 0.875rem;
    color: var(--sport-text-muted);
  }

  &:hover {
    border-color: var(--sport-primary);
    background: rgba(37, 99, 235, 0.05);

    mat-icon, span {
      color: var(--sport-primary);
    }
  }
}
```

---

## 5. Form Actions

### HTML
```html
<div class="form-actions">
  <button type="button" class="btn-secondary" (click)="cancel()">
    <mat-icon>close</mat-icon>
    Anulează
  </button>
  <button type="submit" class="btn-primary" [disabled]="form.invalid || isSaving()">
    <mat-icon>{{ isSaving() ? 'hourglass_empty' : 'save' }}</mat-icon>
    {{ isSaving() ? 'Se salvează...' : 'Salvează' }}
  </button>
</div>
```

### SCSS
```scss
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-subtle);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--sport-text-muted);
  border: 2px solid var(--color-border-subtle);
  border-radius: var(--radius-btn);
  font-weight: 600;
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
  background: var(--gradient-warm); // Amber pentru Admin
  // SAU: var(--gradient-green) pentru Coach
  color: white;
  border: none;
  border-radius: var(--radius-btn);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

---

## 6. Validare și Erori

### Error Messages
```scss
.mat-mdc-form-field-error {
  font-size: 0.75rem;
  color: var(--color-error) !important;
}

// Error state
.mat-mdc-form-field.mat-form-field-invalid {
  .mdc-notched-outline {
    border-color: var(--color-error) !important;
  }
}
```

### Inline Validation Feedback
```html
<mat-form-field appearance="outline">
  <mat-label>Email</mat-label>
  <input matInput formControlName="email" />
  <mat-icon matSuffix *ngIf="form.get('email')?.valid">check_circle</mat-icon>
  <mat-error>Email invalid</mat-error>
</mat-form-field>
```

---

## ✅ Checklist Form Pages

- [ ] **Hero** are back button funcțional?
- [ ] **Secțiunile** sunt grupate logic?
- [ ] **Grid-ul** e responsive (auto-fit)?
- [ ] **Inputurile** au labels clare?
- [ ] **Validarea** arată erori la submit?
- [ ] **Actions** sunt sticky pe mobile?
- [ ] **Loading state** pe butonul Save?
- [ ] **Disabled state** când form e invalid?
