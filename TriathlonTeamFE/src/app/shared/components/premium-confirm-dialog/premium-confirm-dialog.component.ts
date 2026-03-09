import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export type PremiumConfirmDialogVariant = 'warning' | 'danger';

export interface PremiumConfirmDialogData {
  title: string;
  subtitle?: string;
  description: string;
  note?: string;
  confirmIcon?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  variant?: PremiumConfirmDialogVariant;
  irreversible?: boolean;
}

@Component({
  selector: 'app-premium-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './premium-confirm-dialog.component.html',
  styleUrls: ['./premium-confirm-dialog.component.scss']
})
export class PremiumConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PremiumConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PremiumConfirmDialogData
  ) {}

  get variant(): PremiumConfirmDialogVariant {
    return this.data.variant ?? 'warning';
  }

  get isIrreversible(): boolean {
    return this.data.irreversible ?? true;
  }

  get icon(): string {
    if (this.data.icon) {
      return this.data.icon;
    }

    return this.variant === 'danger' ? 'warning' : 'warning_amber';
  }

  get confirmIcon(): string {
    if (this.variant === 'danger') {
      return this.data.confirmIcon ?? 'delete_forever';
    }

    return this.data.confirmIcon ?? this.data.icon ?? 'check_circle';
  }

  get confirmText(): string {
    return this.data.confirmText ?? 'Confirmă';
  }

  get cancelText(): string {
    return this.data.cancelText ?? 'Renunță';
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
