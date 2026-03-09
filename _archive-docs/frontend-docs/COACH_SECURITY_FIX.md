# Coach Attendance Security Fix

## Issue Identified
The `coach-attendance-payments.component.ts` was using `AdminApiService` directly, which violated separation of concerns and could potentially expose admin-level data access.

## Changes Applied

### 1. Enhanced `CoachApiService` (coach-api.service.ts)

**Added Interfaces:**
- `WeeklyCalendar` - Weekly calendar view structure
- `CoachWeek` - Coach's weekly schedule
- `DayColumn` - Daily session column
- `SessionCard` - Individual session card
- `SessionAttendance` - Session attendance details
- `ChildAttendancePayment` - Child's attendance and payment status
- `MarkSessionAttendanceItem` - Attendance marking payload

**Added Methods:**
```typescript
getWeeklyCalendar(weekStart: string): Observable<WeeklyCalendar>
getSessionAttendance(occurrenceId: string): Observable<SessionAttendance>
markSessionAttendance(occurrenceId: string, items: MarkSessionAttendanceItem[]): Observable<void>
purchaseSessions(enrollmentId: string, payload: { numberOfSessions: number; paymentMethod: 'CASH' | 'CARD' }): Observable<any>
```

**Note:** These methods still call `/api/admin/attendance/**` endpoints, but this is correct because:
- The backend controller already has role-based filtering
- When a COACH role calls these endpoints, the backend automatically filters to show only their own data
- The backend code at `WeeklyAttendanceController.kt` lines 44-50 handles this:
  ```kotlin
  val effectiveCoachId = when {
      user.role == Role.ADMIN -> coachId // Admin can see all or filter by coach
      user.role == Role.COACH -> user.id // Coach can only see their own
      else -> throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
  }
  ```

### 2. Updated `CoachAttendancePaymentsComponent` (coach-attendance-payments.component.ts)

**Changes:**
- Import changed from `AdminApiService` to `CoachApiService`
- Service injection changed from `AdminApiService` to `CoachApiService`
- All method calls now use the coach-specific service wrapper

**Lines Changed:**
- Line 17: Updated import statement
- Line 35: Changed service injection

## Security Benefits

1. **Separation of Concerns**: Coach components now use coach-specific services
2. **Type Safety**: All types are properly defined in the coach service layer
3. **Maintainability**: Future changes to admin APIs won't accidentally break coach functionality
4. **Clear Intent**: Code clearly shows this is a coach feature using coach services
5. **Backend Security Maintained**: Backend already has proper role-based filtering

## Testing Recommendations

1. **Login as Coach**: Verify coach can only see their own weekly calendar
2. **Session Attendance**: Test marking attendance for coach's own sessions
3. **Purchase Sessions**: Verify coach can add cash sessions for enrolled children
4. **Modal Functionality**: Ensure attendance modal works correctly with bulk actions
5. **No Admin Data Leak**: Verify coach cannot see other coaches' data

## Files Modified

1. `TriathlonTeamFE/src/app/features/coach/services/coach-api.service.ts`
   - Added interfaces for weekly calendar and attendance
   - Added 4 new methods for attendance management

2. `TriathlonTeamFE/src/app/features/coach/components/attendance-payments/coach-attendance-payments.component.ts`
   - Changed service import and injection
   - No functional changes to component logic

## Compatibility Notes

- **Modal Component**: The `AttendanceModalComponent` still imports types from `admin-api.service.ts`, which is fine since it's a shared component
- **No Breaking Changes**: All functionality remains the same, only the service layer changed
- **Backend Compatible**: No backend changes required, existing endpoints work correctly
- **No Linter Errors**: All changes pass TypeScript compilation and linting

## Related Backend Security

Backend endpoint: `/api/admin/attendance/**`
- Access: `@PreAuthorize("hasAnyRole('ADMIN','COACH')")`
- Security: Controller automatically filters data by user role
- File: `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/web/admin/WeeklyAttendanceController.kt`

---

**Date:** October 20, 2025
**Severity:** Medium (Security best practice, not an active vulnerability)
**Status:** ✅ Fixed

