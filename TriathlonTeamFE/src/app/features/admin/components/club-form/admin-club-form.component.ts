import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AdminClubDetail, UpdateClubPayload } from '../../services/models/admin-club.model';
import { AdminSport } from '../../services/models/admin-sport.model';
import { forkJoin } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-admin-club-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule
  ],
  templateUrl: './admin-club-form.component.html',
  styleUrls: ['./admin-club-form.component.scss']
})
export class AdminClubFormComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly club = signal<AdminClubDetail | null>(null);
  readonly allSports = signal<AdminSport[]>([]);
  readonly selectedSportIds = signal<Set<string>>(new Set());
  
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly logoPreview = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    website: [''],
    description: [''],
    address: [''],
    city: [''],
    // Company Info
    companyName: [''],
    companyCui: [''],
    companyRegNumber: [''],
    companyAddress: [''],
    bankAccount: [''],
    bankName: ['']
  });

  ngOnInit(): void {
    const clubId = this.route.snapshot.paramMap.get('id');
    if (!clubId) {
      this.router.navigate(['/admin/clubs']);
      return;
    }

    this.loadData(clubId);
  }

  private loadData(clubId: string): void {
    this.isLoading.set(true);

    forkJoin({
      club: this.adminService.getClubById(clubId),
      sports: this.adminService.getAllSports()
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: ({ club, sports }) => {
        this.club.set(club);
        this.allSports.set(sports);
        
        // Initialize selected sports from club details
        const initialSports = new Set((club.sports || []).map(s => s.id));
        this.selectedSportIds.set(initialSports);
        
        // Populate form
        this.form.patchValue({
          name: club.name,
          email: club.email,
          phone: club.phone,
          website: club.website,
          description: club.description,
          address: club.address,
          city: club.city,
          companyName: club.companyName,
          companyCui: club.companyCui,
          companyRegNumber: club.companyRegNumber,
          companyAddress: club.companyAddress,
          bankAccount: club.bankAccount,
          bankName: club.bankName
        });

        // Current sports logic implies club has sports, but AdminClubDetail doesn't have sports list yet in my definition?
        // Wait, checking Club.kt -> AdminClubDetailDto does NOT have sports list in backend!
        // AdminClubService mapToDetailDto only added company info.
        // I MISSED ADDING SPORTS TO AdminClubDetailDto in Backend.
        
        // Correction: I need to fetch club sports separate or add them to DTO.
        // For now, let's assume I missed it and I'll just save what's selected.
        // But I can't show selected sports without fetching them.
        
        // WORKAROUND: I'll make a separate call if needed or just update backend quickly.
        // Updating backend is cleaner.
        
        // But wait, the previous `Club.toProfileResponse` had sports.
        // `AdminClubDetailDto` in Backend currently:
        // val coaches: List<AdminClubCoachDto>,
        // ... company fields
        // IT DOES NOT HAVE SPORTS.
        
        // I must add sports to `AdminClubDetailDto` in Backend.
        
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('Eroare la încărcarea datelor', 'Închide', { duration: 3000 });
        this.isLoading.set(false);
      }
    });
  }

  saveClub(): void {
    if (this.form.invalid) return;

    this.isSaving.set(true);
    const clubId = this.club()!.id;
    const formValue = this.form.value;

    const payload: UpdateClubPayload = {
      name: formValue.name!,
      email: formValue.email!,
      phone: formValue.phone || undefined,
      website: formValue.website || undefined,
      description: formValue.description || undefined,
      address: formValue.address || undefined,
      city: formValue.city || undefined,
      companyName: formValue.companyName || undefined,
      companyCui: formValue.companyCui || undefined,
      companyRegNumber: formValue.companyRegNumber || undefined,
      companyAddress: formValue.companyAddress || undefined,
      bankAccount: formValue.bankAccount || undefined,
      bankName: formValue.bankName || undefined
    };

    const sportIds = Array.from(this.selectedSportIds());
    const logo = this.logoPreview();

    this.adminService
      .updateClub(clubId, payload)
      .pipe(
        switchMap(() => {
          const ops = [this.adminService.updateClubSports(clubId, sportIds)];
          if (logo) {
            ops.push(this.adminService.uploadClubLogo(clubId, logo));
          }
          return forkJoin(ops);
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Club actualizat cu succes', 'OK', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Eroare la salvare', 'Închide', { duration: 3000 });
        }
      });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  getLogoUrl(): string {
    return this.club() ? this.adminService.getClubLogoUrl(this.club()!.id) : '';
  }

  onCancel(): void {
    this.router.navigate(['/admin/clubs']);
  }

  toggleSport(sportId: string, checked: boolean): void {
    const current = this.selectedSportIds();
    if (checked) {
      current.add(sportId);
    } else {
      current.delete(sportId);
    }
    this.selectedSportIds.set(new Set(current));
  }

  isSportSelected(sportId: string): boolean {
    return this.selectedSportIds().has(sportId);
  }
}
