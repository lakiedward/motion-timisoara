# Session-Based Payment System - Implementation Summary

## Overview
Successfully transformed the payment model from monthly subscriptions to session-based packages. Users now purchase session packages when enrolling, and each attendance marking deducts one session from their remaining balance.

## ✅ Completed Backend Implementation

### 1. Database Migration
**File:** `TriathlonTeamBE/src/main/resources/db/migration/V10__add_session_based_fields.sql`
- Added `price_per_session` and `package_options` to `courses` table
- Added `purchased_sessions`, `remaining_sessions`, and `sessions_used` to `enrollments` table
- Migrated existing data with sensible defaults
- Added `is_legacy` flag to `monthly_payments` table

### 2. Domain Entities Updated
- **Course.kt**: Added `pricePerSession` and `packageOptions` fields
- **Enrollment.kt**: Added `purchasedSessions`, `remainingSessions`, and `sessionsUsed` fields

### 3. Service Layer Updates
- **CourseService**: Updated DTOs (`CourseRequest`, `CourseResponse`) to include session fields
- **AdminCourseService**: Updated admin DTOs and course creation/update methods
- **CoachCourseController**: Updated coach DTOs to include session pricing
- **EnrollmentService**:
  - Modified to calculate price based on `pricePerSession * sessionPackageSize`
  - Removed monthly payment generation
  - Initializes session counts on enrollment creation
  - Updated `EnrollmentDto` to include session information
- **AdminAttendanceService** & **CoachAttendanceService**:
  - Deducts sessions when marking attendance as PRESENT
  - Restores sessions if attendance is changed from PRESENT
  - Increments `sessionsUsed` counter
- **WeeklyAttendanceService**: Updated to show session balance instead of monthly payment status

### 4. New Session Purchase API
**Files Created:**
- `SessionPurchaseService.kt`: Handles purchasing additional sessions
- `SessionPurchaseController.kt`: REST endpoint at `/api/enrollments/{id}/purchase-sessions`

**Features:**
- Adds sessions to existing enrollment
- Calculates total price based on course's `pricePerSession`
- Supports both CARD and CASH payment methods
- Returns updated session balance

### 5. Repository Updates
- **EnrollmentRepository**: Added `findByKindAndEntityIdAndChildAndStatusIn` method

### 6. Dev Data Initializer
- **DevDataInitializer.kt**: Updated test course to include `pricePerSession = 250`

## ✅ Completed Frontend Implementation

### 1. TypeScript Models Updated
**Files:**
- `admin-course.model.ts`: Added `pricePerSession` and `packageOptions` to `AdminCourseDetail`
- `coach.service.ts`: Added `pricePerSession` and `packageOptions` to `CourseFormPayload`
- `enrollment.service.ts`:
  - Added `sessionPackageSize` to `EnrollmentRequest`
  - Added `purchasedSessions`, `remainingSessions`, `sessionsUsed` to `ParentEnrollmentListItem`
- `session-purchase.service.ts`: Created new service for buying additional sessions

## 📋 Remaining Frontend UI Updates

### 1. Admin Course Form
**File:** `TriathlonTeamFE/src/app/features/admin/components/course-form/*`
**Changes Needed:**
```typescript
// Add to form
pricePerSession: new FormControl(250, Validators.required)
packageOptions: new FormControl('')  // Optional

// In HTML, add after price field:
<mat-form-field>
  <mat-label>Preț per ședință (RON)</mat-label>
  <input matInput type="number" formControlName="pricePerSession" required>
</mat-form-field>

// Optional: Package deals
<mat-form-field>
  <mat-label>Pachete (opțional, ex: "10:250,20:480")</mat-label>
  <input matInput formControlName="packageOptions">
  <mat-hint>Format: "numărȘedințe:preț,numărȘedințe:preț"</mat-hint>
</mat-form-field>
```

### 2. Coach Course Form
**File:** `TriathlonTeamFE/src/app/features/coach/components/course-form/*`
**Changes Needed:** Same as admin course form above

### 3. Course Display (Course Card/Details)
**Files:**
- `TriathlonTeamFE/src/app/features/program/course-card/*`
- `TriathlonTeamFE/src/app/features/program/course-details/*`

**Changes Needed:**
```html
<!-- Replace monthly price display with: -->
<div class="price-info">
  <span class="price">{{ course.pricePerSession }} RON</span>
  <span class="price-label">/ ședință</span>
</div>

<!-- If package options exist, show them: -->
<div *ngIf="course.packageOptions" class="package-deals">
  <h4>Pachete disponibile:</h4>
  <div *ngFor="let package of parsePackages(course.packageOptions)" class="package-option">
    {{ package.sessions }} ședințe: {{ package.price }} RON
  </div>
</div>
```

### 4. Enrollment/Checkout Flow
**File:** `TriathlonTeamFE/src/app/features/account/components/checkout/*`
**Changes Needed:**
```typescript
// Add to component
sessionPackageSize = 10;  // Default
totalPrice = 0;

calculateTotal() {
  this.totalPrice = this.course.pricePerSession * this.sessionPackageSize * this.selectedChildren.length;
}

// In form submission:
const request: EnrollmentRequest = {
  kind: 'COURSE',
  entityId: this.courseId,
  childIds: this.selectedChildIds,
  paymentMethod: this.selectedPaymentMethod,
  sessionPackageSize: this.sessionPackageSize
};
```

```html
<!-- Add session selector before payment -->
<div class="session-selector">
  <h3>Selectați numărul de ședințe</h3>
  <mat-form-field>
    <mat-label>Număr ședințe</mat-label>
    <input matInput type="number" [(ngModel)]="sessionPackageSize" 
           min="1" (change)="calculateTotal()">
  </mat-form-field>
  
  <div class="price-breakdown">
    <p>{{ sessionPackageSize }} ședințe × {{ course.pricePerSession }} RON = {{ totalPrice }} RON</p>
    <p *ngIf="selectedChildren.length > 1">
      × {{ selectedChildren.length }} copii = {{ totalPrice * selectedChildren.length }} RON total
    </p>
  </div>
</div>
```

### 5. Parent Dashboard/Enrollments List
**File:** `TriathlonTeamFE/src/app/features/account/components/enrollments/*`
**Changes Needed:**
```html
<!-- Replace payment status with session info -->
<div class="enrollment-card" *ngFor="let enrollment of enrollments">
  <h3>{{ enrollment.title }}</h3>
  <p>{{ enrollment.childName }}</p>
  
  <!-- Session balance info -->
  <div class="session-info" *ngIf="enrollment.remainingSessions !== undefined">
    <mat-icon [class.warning]="enrollment.remainingSessions <= 3">schedule</mat-icon>
    <span>Ședințe rămase: </span>
    <strong [class.low-balance]="enrollment.remainingSessions <= 3">
      {{ enrollment.remainingSessions }}
    </strong>
    <span class="used-sessions">
      (Folosite: {{ enrollment.sessionsUsed }} / {{ enrollment.purchasedSessions }})
    </span>
    
    <!-- Warning for low balance -->
    <mat-chip *ngIf="enrollment.remainingSessions <= 3" color="warn">
      Sold scăzut
    </mat-chip>
    
    <!-- Buy more button -->
    <button mat-raised-button color="primary" 
            (click)="purchaseMoreSessions(enrollment)">
      Cumpără mai multe ședințe
    </button>
  </div>
</div>
```

```scss
.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  
  .low-balance {
    color: #f44336;
    font-weight: bold;
  }
  
  .used-sessions {
    color: #666;
    font-size: 0.9em;
  }
  
  mat-icon.warning {
    color: #ff9800;
  }
}
```

### 6. Session Purchase Dialog Component
**Create:** `TriathlonTeamFE/src/app/features/account/components/session-purchase-dialog/*`
**Files to create:**
- `session-purchase-dialog.component.ts`
- `session-purchase-dialog.component.html`
- `session-purchase-dialog.component.scss`

**Example Implementation:**
```typescript
// session-purchase-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SessionPurchaseService } from '../../services/session-purchase.service';

export interface SessionPurchaseDialogData {
  enrollmentId: string;
  courseName: string;
  pricePerSession: number;
  currentBalance: number;
}

@Component({
  selector: 'app-session-purchase-dialog',
  templateUrl: './session-purchase-dialog.component.html',
  styleUrls: ['./session-purchase-dialog.component.scss']
})
export class SessionPurchaseDialogComponent {
  sessionCount = 10;
  paymentMethod: 'CARD' | 'CASH' = 'CARD';
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<SessionPurchaseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SessionPurchaseDialogData,
    private sessionPurchaseService: SessionPurchaseService
  ) {}

  get totalPrice(): number {
    return this.sessionCount * this.data.pricePerSession;
  }

  purchase(): void {
    this.loading = true;
    this.sessionPurchaseService
      .purchaseAdditionalSessions(this.data.enrollmentId, {
        sessionCount: this.sessionCount,
        paymentMethod: this.paymentMethod
      })
      .subscribe({
        next: (response) => {
          this.dialogRef.close(response);
        },
        error: () => {
          this.loading = false;
        }
      });
  }
}
```

```html
<!-- session-purchase-dialog.component.html -->
<h2 mat-dialog-title>Cumpără ședințe suplimentare</h2>

<mat-dialog-content>
  <p>Curs: <strong>{{ data.courseName }}</strong></p>
  <p>Sold curent: <strong>{{ data.currentBalance }} ședințe</strong></p>
  
  <mat-form-field class="full-width">
    <mat-label>Număr ședințe</mat-label>
    <input matInput type="number" [(ngModel)]="sessionCount" min="1">
  </mat-form-field>
  
  <mat-radio-group [(ngModel)]="paymentMethod">
    <mat-radio-button value="CARD">Card</mat-radio-button>
    <mat-radio-button value="CASH">Cash</mat-radio-button>
  </mat-radio-group>
  
  <div class="price-summary">
    <p class="price-calculation">
      {{ sessionCount }} ședințe × {{ data.pricePerSession }} RON = 
      <strong>{{ totalPrice }} RON</strong>
    </p>
    <p class="new-balance">
      Sold nou: <strong>{{ data.currentBalance + sessionCount }} ședințe</strong>
    </p>
  </div>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button [disabled]="loading" (click)="dialogRef.close()">Anulează</button>
  <button mat-raised-button color="primary" [disabled]="loading" (click)="purchase()">
    <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
    <span *ngIf="!loading">Cumpără</span>
  </button>
</mat-dialog-actions>
```

### 7. Attendance Marking UI (Coach/Admin)
**Files:**
- `TriathlonTeamFE/src/app/features/coach/components/attendance-payments/*`
- `TriathlonTeamFE/src/app/features/admin/components/attendance-payments/*`

**Changes Needed:**
```html
<!-- Update child list to show session info -->
<div class="child-row" *ngFor="let child of children">
  <span class="child-name">{{ child.childName }}</span>
  
  <!-- Session balance (replaces payment status) -->
  <div class="session-balance">
    <mat-icon [class.warning]="child.lowSessionWarning">schedule</mat-icon>
    <span>{{ child.remainingSessions }} ședințe</span>
    <mat-chip *ngIf="child.lowSessionWarning" color="warn" class="low-badge">
      Sold scăzut
    </mat-chip>
  </div>
  
  <!-- Attendance buttons -->
  <div class="attendance-buttons">
    <button mat-icon-button (click)="markPresent(child)" 
            [class.active]="child.attendanceStatus === 'PRESENT'">
      <mat-icon>check_circle</mat-icon>
    </button>
    <button mat-icon-button (click)="markAbsent(child)"
            [class.active]="child.attendanceStatus === 'ABSENT'">
      <mat-icon>cancel</mat-icon>
    </button>
  </div>
</div>
```

```typescript
// Update interface to match backend DTO
interface ChildAttendanceInfo {
  childId: string;
  childName: string;
  attendanceStatus?: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  remainingSessions: number;
  sessionsUsed: number;
  lowSessionWarning: boolean;  // true if remainingSessions <= 3
}
```

## Migration Notes

### For Existing Data
- The migration script sets all existing enrollments to 30 sessions (purchased and remaining)
- Existing courses get `pricePerSession = price / 8` (assuming 8 sessions/month)
- All existing `monthly_payments` are marked as `is_legacy = true`

### For New Enrollments
- Default session package size is 10 if not specified
- Users can choose custom package sizes during enrollment
- Camps remain as single-payment (not session-based)

## API Changes Summary

### New Endpoints
- `POST /api/enrollments/{enrollmentId}/purchase-sessions` - Buy additional sessions

### Modified Endpoints
- `POST /api/enrollments` - Now accepts `sessionPackageSize`
- `GET /api/enrollments/me` - Now returns session info
- `GET /api/parent/enrollments` - Now includes session fields
- Course endpoints - Now include `pricePerSession` and `packageOptions`
- Attendance endpoints - Now deduct sessions automatically

### Deprecated (but kept for backward compatibility)
- Monthly payment endpoints still work for legacy data viewing
- Monthly payment generation removed from new enrollments

## Testing Checklist

### Backend
- [x] Database migration runs successfully
- [x] Course creation with session pricing
- [x] Enrollment with session package selection
- [x] Attendance marking deducts sessions
- [x] Attendance status change restores sessions
- [x] Additional session purchase
- [x] Low balance detection (≤ 3 sessions)

### Frontend (To Complete)
- [ ] Course form shows session pricing fields
- [ ] Course display shows price per session
- [ ] Enrollment flow allows session selection
- [ ] Parent dashboard shows session balance
- [ ] Low balance warning displays correctly
- [ ] Session purchase dialog works
- [ ] Attendance UI shows session info
- [ ] Session count updates after marking attendance

## Next Steps

1. **Update UI Components** - Follow the examples above for each component
2. **Add Styling** - Create consistent styling for session info displays
3. **Add Notifications** - Show toast messages for low balance warnings
4. **Testing** - Test complete flow from course creation to session usage
5. **User Documentation** - Update help docs to explain session-based system

## Key Benefits

1. ✅ **Flexibility** - Users buy exactly what they need
2. ✅ **Transparency** - Clear visibility of remaining sessions
3. ✅ **Automatic Tracking** - Sessions deducted automatically on attendance
4. ✅ **No Hard Blocking** - Children can still attend with 0 sessions (soft warning)
5. ✅ **Easy Top-up** - Parents can buy more sessions anytime
6. ✅ **Better for Coaches** - Clear pricing per session, optional package deals

