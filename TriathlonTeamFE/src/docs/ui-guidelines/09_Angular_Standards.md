# 🅰️ Angular Standards & Architecture

Standarde pentru cod Angular în acest proiect.

---

## Principii Fundamentale

### 1. Standalone Components (OBLIGATORIU)
```typescript
@Component({
  standalone: true,
  imports: [CommonModule, MatButtonModule, ...],
  // ...
})
export class MyComponent {}
```

### 2. OnPush Change Detection (OBLIGATORIU)
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

### 3. Signals over BehaviorSubject
Folosiți `signal()`, `computed()`, `effect()` pentru state local.

```typescript
// ✅ CORECT
readonly items = signal<Item[]>([]);
readonly count = computed(() => this.items().length);
readonly isLoading = signal(false);

// ❌ GREȘIT
private items$ = new BehaviorSubject<Item[]>([]);
```

### 4. Typed Reactive Forms
```typescript
// ✅ CORECT
readonly form = new FormGroup({
  name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
});

// Type inference
type FormType = typeof this.form.value;
```

---

## Structură Componentă Standard

```typescript
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExampleComponent implements OnInit {
  // ═══════════════════════════════════════════
  // 1. DEPENDENCY INJECTION
  // ═══════════════════════════════════════════
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // ═══════════════════════════════════════════
  // 2. SIGNALS (State)
  // ═══════════════════════════════════════════
  readonly items = signal<Item[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly selectedId = signal<string | null>(null);

  // ═══════════════════════════════════════════
  // 3. COMPUTED (Derived State)
  // ═══════════════════════════════════════════
  readonly itemCount = computed(() => this.items().length);
  readonly activeItems = computed(() => 
    this.items().filter(item => item.active)
  );
  readonly selectedItem = computed(() =>
    this.items().find(item => item.id === this.selectedId())
  );

  // ═══════════════════════════════════════════
  // 4. LIFECYCLE
  // ═══════════════════════════════════════════
  ngOnInit(): void {
    this.loadData();
  }

  // ═══════════════════════════════════════════
  // 5. PUBLIC METHODS (Template Actions)
  // ═══════════════════════════════════════════
  selectItem(id: string): void {
    this.selectedId.set(id);
  }

  refresh(): void {
    this.loadData();
  }

  // ═══════════════════════════════════════════
  // 6. PRIVATE METHODS
  // ═══════════════════════════════════════════
  private loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.api.getItems()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
          this.snackbar.open('Eroare la încărcare', undefined, { duration: 4000 });
        }
      });
  }
}
```

---

## Template Patterns

### Control Flow (Angular 17+)
```html
<!-- Conditionals -->
@if (isLoading()) {
  <div class="loading">Se încarcă...</div>
}

@if (hasError()) {
  <div class="error">Eroare!</div>
} @else if (items().length === 0) {
  <div class="empty">Nu există date.</div>
} @else {
  <div class="content">...</div>
}

<!-- Loops -->
@for (item of items(); track item.id) {
  <app-item-card [item]="item" />
}

<!-- Switch -->
@switch (status()) {
  @case ('loading') { <spinner /> }
  @case ('error') { <error-message /> }
  @default { <content /> }
}
```

### Track Function
```html
<!-- Track by id (OBLIGATORIU pentru performance) -->
@for (item of items(); track item.id) {
  ...
}

<!-- Sau cu funcție -->
@for (item of items(); track trackByItem($index, item)) {
  ...
}
```

```typescript
trackByItem(_: number, item: Item): string {
  return item.id;
}
```

---

## Service Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/items';

  getAll(): Observable<Item[]> {
    return this.http.get<Item[]>(this.baseUrl);
  }

  getById(id: string): Observable<Item> {
    return this.http.get<Item>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateItemRequest): Observable<Item> {
    return this.http.post<Item>(this.baseUrl, data);
  }

  update(id: string, data: UpdateItemRequest): Observable<Item> {
    return this.http.put<Item>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

---

## RxJS Patterns

### takeUntilDestroyed (OBLIGATORIU)
```typescript
private readonly destroyRef = inject(DestroyRef);

ngOnInit() {
  this.api.getData()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(data => this.items.set(data));
}
```

### Combining Observables
```typescript
// Parallel requests
forkJoin({
  items: this.api.getItems(),
  categories: this.api.getCategories()
}).pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(({ items, categories }) => {
    this.items.set(items);
    this.categories.set(categories);
  });
```

### Error Handling
```typescript
this.api.save(data).pipe(
  takeUntilDestroyed(this.destroyRef),
  catchError(error => {
    this.snackbar.open(error.message || 'Eroare', undefined, { duration: 4000 });
    return EMPTY;
  })
).subscribe(() => {
  this.snackbar.open('Salvat cu succes!', undefined, { duration: 3000 });
  this.router.navigate(['/items']);
});
```

---

## Forms Best Practices

### Reactive Form Setup
```typescript
readonly form = new FormGroup({
  name: new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)]
  }),
  email: new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email]
  }),
  type: new FormControl<ItemType>('default', { nonNullable: true })
});

// Getter pentru acces ușor
get nameControl() { return this.form.controls.name; }
```

### Form Submission
```typescript
readonly isSaving = signal(false);

onSubmit(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.isSaving.set(true);
  const data = this.form.getRawValue();

  this.api.save(data).pipe(
    takeUntilDestroyed(this.destroyRef),
    finalize(() => this.isSaving.set(false))
  ).subscribe({
    next: () => {
      this.snackbar.open('Salvat!', undefined, { duration: 3000 });
      this.router.navigate(['/list']);
    },
    error: (err) => {
      this.snackbar.open(err.message || 'Eroare', undefined, { duration: 4000 });
    }
  });
}
```

---

## Routing Patterns

### Route Guards
```typescript
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  
  return router.createUrlTree(['/login']);
};
```

### Lazy Loading
```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes')
      .then(m => m.ADMIN_ROUTES),
    canActivate: [authGuard, adminGuard]
  }
];
```

---

## View Encapsulation

### Reguli
- **Default:** `Emulated` (păstrați)
- **NU folosiți:** `::ng-deep` decât în cazuri excepționale
- **Preferați:** Clase globale în `styles.css` pentru override-uri

### Când e necesar ::ng-deep
```scss
// DOAR pentru componente third-party (Angular Material)
// și DOAR într-un :host context
:host ::ng-deep {
  .mat-mdc-form-field {
    // override specific
  }
}
```

---

## ✅ Code Review Checklist

- [ ] Component e `standalone: true`?
- [ ] Change detection e `OnPush`?
- [ ] State folosește `signal()`?
- [ ] Subscriptions au `takeUntilDestroyed()`?
- [ ] Forms sunt typed (`FormGroup<T>`)?
- [ ] Track function e prezentă în `@for`?
- [ ] Erorile sunt handled corect?
- [ ] Loading states există?
