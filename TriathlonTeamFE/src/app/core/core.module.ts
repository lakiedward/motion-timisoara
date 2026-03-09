import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * CoreModule is no longer used - interceptors are configured in app.config.ts.
 * Kept for backward compatibility but can be safely deleted.
 */
@NgModule({
  imports: [CommonModule],
})
export class CoreModule {}
