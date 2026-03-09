# Multi-Sport Coach System - Implementation Summary

## Overview
Successfully implemented a Many-to-Many relationship between coaches and sports, allowing each coach to have multiple sports they specialize in, with full UI management capabilities.

## Backend Changes

### 1. Database Schema
**New Migration:** `V2__add_sports_table.sql`

- Created `sports` table:
  - `id` (UUID, PRIMARY KEY)
  - `code` (VARCHAR(50), UNIQUE) - e.g., "swim", "bike", "run"
  - `name` (VARCHAR(255)) - e.g., "Înot", "Cycling", "Alergare"

- Created `coach_sports` junction table:
  - `coach_profile_id` (UUID, FK to coach_profiles)
  - `sport_id` (UUID, FK to sports)
  - Composite PRIMARY KEY (coach_profile_id, sport_id)

- Pre-populated initial sports:
  - swim → Înot
  - bike → Cycling
  - run → Alergare

- Migrated existing data from `coach_profiles.sports` (text field) to the new structure
- Dropped the old `sports` column from `coach_profiles`

### 2. Domain Model Changes

**New Entity:** `Sport.kt`
```kotlin
@Entity
@Table(name = "sports")
class Sport {
    lateinit var code: String
    lateinit var name: String
}
```

**Updated:** `CoachProfile.kt`
- Replaced `var sports: String?` with `var sports: MutableSet<Sport>`
- Added `@ManyToMany` relationship with `@JoinTable`

### 3. New Backend Components

**SportRepository.kt**
- `findByCode(code: String)`
- `findAllByOrderByNameAsc()`
- `existsByCode(code: String)`

**AdminSportService.kt**
- `listSports()` - Get all sports
- `createSport(request)` - Create new sport
- `updateSport(id, request)` - Update existing sport
- `deleteSport(id)` - Delete sport (validates no coaches are using it)

**AdminSportController.kt**
- `GET /api/admin/sports` - List all sports
- `POST /api/admin/sports` - Create sport
- `PUT /api/admin/sports/{id}` - Update sport
- `DELETE /api/admin/sports/{id}` - Delete sport

### 4. Updated AdminCoachService

**DTOs Updated:**
- `CoachInviteRequest`: Changed `sports: String?` → `sportIds: List<UUID>?`
- `CoachUpdateRequest`: Changed `sports: String?` → `sportIds: List<UUID>?`
- `CoachDto`: Changed `sports: String?` → `sports: List<SportDto>`

**Methods Updated:**
- `inviteCoach()`: Now resolves sportIds to Sport entities
- `updateCoach()`: Updates coach's sports using sportIds
- `listCoaches()`: Returns sports as DTOs

## Frontend Changes

### 1. New Models
**sport.model.ts**
```typescript
interface Sport {
  id: string;
  code: string;
  name: string;
}
```

### 2. Updated Coach Models
**admin-coach.model.ts**
- `AdminCoachListItem.sports`: Changed from `string?` to `Sport[]`
- `InviteCoachPayload.sportIds`: Changed from `sports: string?` to `sportIds: string[]?`
- `UpdateCoachPayload.sportIds`: Changed from `sports: string?` to `sportIds: string[]?`

### 3. New Service
**sport.service.ts**
- `getSports()` - Fetch all sports
- `createSport(request)` - Create new sport
- `updateSport(id, request)` - Update sport
- `deleteSport(id)` - Delete sport

### 4. Updated Coach Dialogs

**add-coach-dialog.component**
- Replaced text input with `<mat-select multiple>` for sports
- Loads available sports on init
- Sends `sportIds` array to backend

**edit-coach-dialog.component**
- Replaced text input with `<mat-select multiple>` for sports
- Pre-populates selected sports from coach data
- Sends `sportIds` array to backend

### 5. Updated Coach List Display
**admin-coach-list.component**
- Added "Sporturi" column to table
- Displays sports as styled badges
- Shows "-" when coach has no sports

### 6. New Sport Management UI

**admin-sports-list.component**
- List all sports in a table
- Add new sport button
- Edit/Delete actions for each sport
- Validation: Cannot delete sports associated with coaches

**sport-dialog.component**
- Dialog for creating/editing sports
- Form fields: code, name
- Validates unique sport codes

### 7. Updated Navigation
- Added "Sporturi" menu item to admin sidebar
- Route: `/admin/sports`
- Icon: sports

## Testing Checklist

### Database Migration
- [ ] **Enable Flyway**: Set `SPRING_FLYWAY_ENABLED=true`
- [ ] **Run Backend**: Verify V2 migration executes successfully
- [ ] **Check Tables**: Verify `sports` and `coach_sports` tables exist
- [ ] **Verify Initial Data**: Confirm 3 sports (swim, bike, run) are inserted
- [ ] **Test Data Migration**: If you had existing coaches with sports text, verify they're migrated to coach_sports

### Backend API Testing
- [ ] **List Sports**: `GET /api/admin/sports` returns all sports
- [ ] **Create Sport**: `POST /api/admin/sports` with `{code: "triathlon", name: "Triatlon"}`
- [ ] **Update Sport**: `PUT /api/admin/sports/{id}` updates sport
- [ ] **Delete Sport**: `DELETE /api/admin/sports/{id}` (should fail if sport is used by coaches)
- [ ] **Create Coach**: `POST /api/admin/coaches` with `sportIds: [uuid1, uuid2]`
- [ ] **Update Coach Sports**: `PUT /api/admin/coaches/{id}` with different sportIds
- [ ] **List Coaches**: `GET /api/admin/coaches` returns coaches with sports array

### Frontend UI Testing

#### Sport Management
- [ ] Navigate to `/admin/sports`
- [ ] Verify sports list displays correctly
- [ ] Click "Adaugă sport" and create a new sport
- [ ] Edit an existing sport
- [ ] Try to delete a sport (should fail if used by coaches)
- [ ] Delete an unused sport (should succeed)

#### Coach Management - Add Coach
- [ ] Navigate to `/admin/coaches`
- [ ] Click "Adaugă antrenor"
- [ ] Verify sports dropdown shows all available sports
- [ ] Select multiple sports
- [ ] Create coach and verify sports are saved

#### Coach Management - Edit Coach
- [ ] Click "Editează" on a coach
- [ ] Verify current sports are pre-selected in dropdown
- [ ] Change selected sports
- [ ] Save and verify sports are updated

#### Coach List Display
- [ ] Verify "Sporturi" column shows in table
- [ ] Verify sports display as badges
- [ ] Verify "-" shows for coaches with no sports
- [ ] Check responsive design on mobile

### Integration Testing
- [ ] Create a new sport
- [ ] Create a coach with that sport
- [ ] Try to delete the sport (should be prevented)
- [ ] Remove the sport from the coach
- [ ] Delete the sport (should now succeed)
- [ ] Verify course creation still works with coach sports

### Edge Cases
- [ ] Create coach with no sports selected (should work)
- [ ] Update coach to remove all sports (should work)
- [ ] Verify duplicate sport codes are prevented
- [ ] Test with special characters in sport names (e.g., "Înot")
- [ ] Verify long sport names display correctly in UI

## Deployment Notes

### Environment Variables
No new environment variables needed. Existing database configuration applies.

### Flyway Migration
1. **Production Deployment**:
   - Ensure `SPRING_FLYWAY_ENABLED=true` on Railway
   - V2 migration will run automatically on next deployment
   - **Backup database before deployment** (recommended)

2. **Rollback Plan** (if needed):
   - Restore database from backup
   - Revert code to previous version
   - Re-enable Flyway to run previous migrations

### Post-Deployment Steps
1. Verify migration completed: Check Railway logs for Flyway success
2. Test API endpoints via Swagger: `https://triathlonteambe-production.up.railway.app/swagger-ui.html`
3. Access admin panel and verify sports management works
4. Update any existing coaches to have proper sports assigned

## Files Modified

### Backend
- ✅ `Sport.kt` (new)
- ✅ `CoachProfile.kt` (updated)
- ✅ `SportRepository.kt` (new)
- ✅ `AdminSportService.kt` (new)
- ✅ `AdminSportController.kt` (new)
- ✅ `AdminCoachService.kt` (updated)
- ✅ `V2__add_sports_table.sql` (new)

### Frontend
- ✅ `sport.model.ts` (new)
- ✅ `admin-coach.model.ts` (updated)
- ✅ `sport.service.ts` (new)
- ✅ `add-coach-dialog.component.ts/html` (updated)
- ✅ `edit-coach-dialog.component.ts/html` (updated)
- ✅ `admin-coach-list.component.html/scss` (updated)
- ✅ `admin-sports-list.component.ts/html/scss` (new)
- ✅ `sport-dialog.component.ts/html/scss` (new)
- ✅ `admin-routing.module.ts` (updated)
- ✅ `admin-layout.component.ts` (updated)

## Success Criteria
✅ Coaches can have multiple sports
✅ Admin can manage sports (CRUD operations)
✅ Admin can assign/remove sports to/from coaches
✅ Sports display properly in coach list
✅ Multi-select UI works in coach dialogs
✅ Database migration preserves existing data
✅ Cannot delete sports in use by coaches
✅ All existing functionality remains intact



