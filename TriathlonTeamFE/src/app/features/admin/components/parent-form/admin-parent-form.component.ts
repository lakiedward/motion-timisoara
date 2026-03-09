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
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { AdminService, AdminUser, AdminChild, AdminChildPayload, UpdateUserPayload } from '../../services/admin.service';

interface ChildFormData {
  id: string | null;
  name: string;
  birthDate: string;
  level: string;
  allergies: string;
  emergencyContactName: string;
  emergencyPhone: string;
  secondaryContactName: string;
  secondaryPhone: string;
  tshirtSize: string;
  hasPhoto: boolean;
  enrollmentsCount: number;
  isNew: boolean;
  isEditing: boolean;
  photoPreview: string | null;
}

@Component({
  selector: 'app-admin-parent-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './admin-parent-form.component.html',
  styleUrls: ['./admin-parent-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminParentFormComponent implements OnInit {
  private readonly api = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly userId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly isSaving = signal(false);
  readonly user = signal<AdminUser | null>(null);
  readonly children = signal<ChildFormData[]>([]);
  readonly editingChildIndex = signal<number | null>(null);

  readonly parentForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['']
  });

  readonly childForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    birthDate: ['', Validators.required],
    level: [''],
    allergies: [''],
    emergencyContactName: [''],
    emergencyPhone: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{6,20}$/)]],
    secondaryContactName: [''],
    secondaryPhone: [''],
    tshirtSize: ['']
  });

  readonly levels = ['Începător', 'Intermediar', 'Avansat'];
  readonly tshirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly roles = ['ADMIN', 'CLUB', 'COACH', 'PARENT'];

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.userId.set(id);
      if (id) {
        this.loadData(id);
      } else {
        this.loadError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  private loadData(userId: string): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    forkJoin({
      user: this.api.getUserById(userId),
      children: this.api.getUserChildren(userId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ user, children }) => {
          this.user.set(user);
          this.parentForm.patchValue({
            name: user.name,
            email: user.email,
            phone: user.phone || ''
          });

          const childrenData: ChildFormData[] = children.map((c) => ({
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            level: c.level || '',
            allergies: c.allergies || '',
            emergencyContactName: c.emergencyContactName || '',
            emergencyPhone: c.emergencyPhone || '',
            secondaryContactName: c.secondaryContactName || '',
            secondaryPhone: c.secondaryPhone || '',
            tshirtSize: c.tshirtSize || '',
            hasPhoto: c.hasPhoto,
            enrollmentsCount: c.enrollmentsCount,
            isNew: false,
            isEditing: false,
            photoPreview: null
          }));
          this.children.set(childrenData);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.isLoading.set(false);
        }
      });
  }

  saveParent(): void {
    if (this.parentForm.invalid || this.isSaving()) {
      this.parentForm.markAllAsTouched();
      return;
    }

    const userId = this.userId();
    if (!userId) return;

    this.isSaving.set(true);
    const formValue = this.parentForm.getRawValue();
    const payload: UpdateUserPayload = {
      name: formValue.name,
      email: formValue.email,
      phone: formValue.phone || undefined
    };

    this.api
      .updateUser(userId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.isSaving.set(false);
          this.user.set(updatedUser);
          this.snackbar.open('Datele părintelui au fost actualizate', undefined, { duration: 3000 });
        },
        error: (err) => {
          this.isSaving.set(false);
          const message = err?.error?.message || 'Nu am putut actualiza datele';
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  // ========== CHILD MANAGEMENT ==========

  startAddChild(): void {
    this.childForm.reset();
    const newChild: ChildFormData = {
      id: null,
      name: '',
      birthDate: '',
      level: '',
      allergies: '',
      emergencyContactName: '',
      emergencyPhone: '',
      secondaryContactName: '',
      secondaryPhone: '',
      tshirtSize: '',
      hasPhoto: false,
      enrollmentsCount: 0,
      isNew: true,
      isEditing: true,
      photoPreview: null
    };
    const current = this.children();
    this.children.set([...current, newChild]);
    this.editingChildIndex.set(current.length);
  }

  startEditChild(index: number): void {
    const child = this.children()[index];
    this.childForm.patchValue({
      name: child.name,
      birthDate: child.birthDate,
      level: child.level,
      allergies: child.allergies,
      emergencyContactName: child.emergencyContactName,
      emergencyPhone: child.emergencyPhone,
      secondaryContactName: child.secondaryContactName,
      secondaryPhone: child.secondaryPhone,
      tshirtSize: child.tshirtSize
    });
    const updated = this.children().map((c, i) => ({
      ...c,
      isEditing: i === index
    }));
    this.children.set(updated);
    this.editingChildIndex.set(index);
  }

  cancelEditChild(index: number): void {
    const child = this.children()[index];
    if (child.isNew) {
      // Remove the new unsaved child
      const updated = this.children().filter((_, i) => i !== index);
      this.children.set(updated);
    } else {
      // Just cancel editing
      const updated = this.children().map((c) => ({ ...c, isEditing: false }));
      this.children.set(updated);
    }
    this.editingChildIndex.set(null);
    this.childForm.reset();
  }

  saveChild(index: number): void {
    if (this.childForm.invalid) {
      this.childForm.markAllAsTouched();
      return;
    }

    const userId = this.userId();
    if (!userId) return;

    const child = this.children()[index];
    const formValue = this.childForm.getRawValue();
    const pendingPhoto = child.isNew ? child.photoPreview : null;
    const localHasPhoto = Boolean(child.hasPhoto || (!child.isNew && !!child.photoPreview));

    const payload: AdminChildPayload = {
      name: formValue.name,
      birthDate: formValue.birthDate,
      level: formValue.level || undefined,
      allergies: formValue.allergies || undefined,
      emergencyContactName: formValue.emergencyContactName || undefined,
      emergencyPhone: formValue.emergencyPhone,
      secondaryContactName: formValue.secondaryContactName || undefined,
      secondaryPhone: formValue.secondaryPhone || undefined,
      tshirtSize: formValue.tshirtSize || undefined
    };

    this.isSaving.set(true);

    const request$ = child.isNew
      ? this.api.createUserChild(userId, payload).pipe(
          switchMap((savedChild) => {
            if (!pendingPhoto) {
              return of({ savedChild, photoUploaded: false });
            }
            return this.api
              .uploadUserChildPhoto(userId, savedChild.id, pendingPhoto)
              .pipe(switchMap(() => of({ savedChild, photoUploaded: true })));
          })
        )
      : this.api
          .updateUserChild(userId, child.id!, payload)
          .pipe(switchMap((savedChild) => of({ savedChild, photoUploaded: false })));

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ savedChild, photoUploaded }) => {
        this.isSaving.set(false);
        const hasPhoto = Boolean(savedChild.hasPhoto || localHasPhoto || photoUploaded);
        const updated = this.children().map((c, i) =>
          i === index
            ? {
                id: savedChild.id,
                name: savedChild.name,
                birthDate: savedChild.birthDate,
                level: savedChild.level || '',
                allergies: savedChild.allergies || '',
                emergencyContactName: savedChild.emergencyContactName || '',
                emergencyPhone: savedChild.emergencyPhone || '',
                secondaryContactName: savedChild.secondaryContactName || '',
                secondaryPhone: savedChild.secondaryPhone || '',
                tshirtSize: savedChild.tshirtSize || '',
                hasPhoto,
                enrollmentsCount: savedChild.enrollmentsCount,
                isNew: false,
                isEditing: false,
                photoPreview: null
              }
            : c
        );
        this.children.set(updated);
        this.editingChildIndex.set(null);
        this.childForm.reset();
        this.snackbar.open(
          child.isNew ? 'Copilul a fost adăugat' : 'Datele copilului au fost actualizate',
          undefined,
          { duration: 3000 }
        );
      },
      error: (err) => {
        this.isSaving.set(false);
        const message = err?.error?.message || 'Nu am putut salva datele copilului';
        this.snackbar.open(message, undefined, { duration: 4000 });
      }
    });
  }

  deleteChild(index: number): void {
    const userId = this.userId();
    const child = this.children()[index];
    if (!userId || !child.id) return;

    if (child.enrollmentsCount > 0) {
      if (!confirm(`Copilul are ${child.enrollmentsCount} înscrieri. Sigur vrei să îl ștergi? Toate datele asociate vor fi șterse.`)) {
        return;
      }
    } else {
      if (!confirm(`Sigur vrei să ștergi copilul "${child.name}"?`)) {
        return;
      }
    }

    this.api
      .deleteUserChild(userId, child.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const updated = this.children().filter((_, i) => i !== index);
          this.children.set(updated);
          this.snackbar.open('Copilul a fost șters', undefined, { duration: 3000 });
        },
        error: (err) => {
          const message = err?.error?.message || 'Nu am putut șterge copilul';
          this.snackbar.open(message, undefined, { duration: 4000 });
        }
      });
  }

  getChildPhotoUrl(childId: string): string | null {
    const userId = this.userId();
    if (userId && childId) {
      return this.api.getUserChildPhotoUrl(userId, childId);
    }
    return null;
  }

  onChildPhotoSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      this.snackbar.open('Format invalid. Formatul permis: JPEG, PNG, GIF, WEBP', undefined, { duration: 4000 });
      return;
    }

    if (file.size > maxSize) {
      this.snackbar.open('Imaginea este prea mare. Dimensiunea maximă: 10MB', undefined, { duration: 4000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const userId = this.userId();
      const child = this.children()[index];

      if (!userId || !child.id) {
        // For new children, just store the preview
        const updated = this.children().map((c, i) =>
          i === index ? { ...c, photoPreview: base64 } : c
        );
        this.children.set(updated);
        return;
      }

      // Upload photo for existing children
      this.api
        .uploadUserChildPhoto(userId, child.id, base64)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            const updated = this.children().map((c, i) =>
              i === index ? { ...c, hasPhoto: true, photoPreview: base64 } : c
            );
            this.children.set(updated);
            this.snackbar.open('Fotografia a fost încărcată', undefined, { duration: 3000 });
          },
          error: () => {
            this.snackbar.open('Nu am putut încărca fotografia', undefined, { duration: 4000 });
          }
        });
    };
    reader.readAsDataURL(file);
  }

  onCancel(): void {
    void this.router.navigate(['/admin/users']);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  calculateAge(birthDate: string): number {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
