# Coach Photo Upload Implementation Summary

## Overview
Successfully implemented coach photo upload functionality with binary storage in the database and retrieval through dedicated endpoints. Photos are displayed across all coach-related screens (admin and public).

## Backend Implementation

### 1. Database Schema
- **Migration**: `V3__add_coach_photo.sql`
  - Added `photo` column (BYTEA) to `coach_profiles` table
  - Added `photo_content_type` column (VARCHAR 100) to store MIME type

### 2. Entity Updates
- **CoachProfile.kt**
  - Added `@Lob` annotated `photo: ByteArray?` field
  - Added `photoContentType: String?` field

### 3. DTOs and Request Models
- **AdminCoachController.kt**
  - Updated `InviteCoachRequest` with `photo: String?` (Base64)
  - Updated `UpdateCoachRequest` with `photo: String?` (Base64)
  
- **AdminCoachService.kt**
  - Updated `CoachInviteRequest` with `photo: String?`
  - Updated `CoachUpdateRequest` with `photo: String?`
  - Updated `CoachDto` with `hasPhoto: Boolean` flag

### 4. Service Layer - Photo Processing
- **AdminCoachService.kt**
  - Implemented `processPhoto()` method:
    - Handles data URL format (e.g., `data:image/jpeg;base64,...`)
    - Decodes Base64 to ByteArray
    - Validates content type (JPEG, PNG, GIF, WEBP)
    - Validates file size (max 5MB)
    - Detects content type from binary signature if needed
  - Updated `inviteCoach()` to process and store photos
  - Updated `updateCoach()` to process and update photos
  - Updated `listCoaches()` to include `hasPhoto` flag

### 5. Controller Endpoints
- **Admin Endpoint**: `/api/admin/coaches/{id}/photo`
  - GET request serves photo as binary
  - Sets appropriate Content-Type header
  - Returns 404 if no photo exists
  
- **Public Endpoint**: `/api/public/coaches/{id}/photo`
  - GET request serves photo as binary for public access
  - Validates coach is enabled before serving photo
  - Sets appropriate Content-Type header
  - Returns 404 if no photo exists

## Frontend Implementation

### 1. Models
- **admin-coach.model.ts**
  - Added `photo?: string` to `InviteCoachPayload`
  - Added `photo?: string` to `UpdateCoachPayload`
  - Added `hasPhoto?: boolean` to `AdminCoachListItem`

### 2. Admin Coach Form Component
- **admin-coach-form.component.ts**
  - Added signals for photo preview and file handling:
    - `photoPreview: Signal<string | null>`
    - `photoFile: Signal<File | null>`
  - Implemented `onFileSelected()`: validates file type and size, converts to Base64
  - Implemented `removePhoto()`: clears photo selection
  - Implemented `getPhotoUrl()`: constructs photo URL for existing coaches
  - Updated `onSubmit()`: includes photo in payload

- **admin-coach-form.component.html**
  - Added photo upload section with:
    - Hidden file input (accept="image/*")
    - Photo preview (180x180px)
    - Remove photo button
    - Upload/change button
    - Size and format hints

- **admin-coach-form.component.scss**
  - Added styles for photo upload section
  - Photo preview with circular display
  - Hover effects and transitions
  - Responsive design

### 3. Admin Service
- **admin.service.ts**
  - Added `getCoachPhotoUrl(coachId: string): string` method

### 4. Admin Coach List Display
- **admin-coach-list.component.ts**
  - Added `getCoachPhotoUrl()` method
  - Added `getInitials()` method for fallback avatar

- **admin-coach-list.component.html**
  - Added "Foto" column to table
  - Displays photo or fallback with initials
  - Error handling with fallback to initials

- **admin-coach-list.component.scss**
  - Added `.coach-avatar` styles (48x48px circular)
  - Added `.coach-avatar-fallback` with gradient background

### 5. Public Coach Display
- **coaches-list.component.ts & coach-profile.component.ts**
  - Added `getCoachPhotoUrl()` method in both components

- **coaches-list.component.html**
  - Updated to use photo endpoint with fallback image on error

- **coach-profile.component.html**
  - Updated to use photo endpoint with fallback to placeholder on error

## Validation & Error Handling

### Frontend Validation
- Maximum file size: 5MB
- Allowed formats: JPEG, PNG, GIF, WEBP
- User-friendly error messages in Romanian

### Backend Validation
- Base64 decoding validation
- Content type validation (JPEG, PNG, GIF, WEBP)
- File size validation (5MB maximum)
- Binary signature detection for content type
- Proper HTTP error responses

## Photo Display Locations

1. **Admin Coach Form**
   - Preview during upload/edit
   - Shows current photo in edit mode

2. **Admin Coach List**
   - Thumbnail (48x48px) in table
   - Fallback to initials if no photo

3. **Public Coaches List**
   - Avatar in coach cards
   - Fallback to default image on error

4. **Public Coach Profile**
   - Large avatar in hero section
   - Fallback to placeholder on error

## Key Features

- ✅ Binary storage in database (BYTEA)
- ✅ Base64 encoding for transfer
- ✅ Content type detection and validation
- ✅ File size validation (5MB)
- ✅ Format validation (JPEG, PNG, GIF, WEBP)
- ✅ Separate endpoints for admin and public access
- ✅ Graceful fallbacks when photos missing
- ✅ Responsive design
- ✅ Error handling at all levels

## Testing Recommendations

1. **Upload Flow**
   - Create new coach with photo
   - Edit coach and update photo
   - Verify photo displays in admin list

2. **Display Flow**
   - Check admin list shows photos
   - Check public coaches list shows photos
   - Check public coach profile shows photo

3. **Validation**
   - Test file size > 5MB (should reject)
   - Test unsupported formats (should reject)
   - Test valid formats (should accept)

4. **Error Handling**
   - Delete photo from database, verify fallback
   - Network error while loading photo
   - Invalid photo data

## Files Modified

### Backend
- `TriathlonTeamBE/src/main/resources/db/migration/V3__add_coach_photo.sql`
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/domain/CoachProfile.kt`
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/web/AdminCoachController.kt`
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/service/AdminCoachService.kt`
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/web/public/PublicCoachController.kt`
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/service/public/PublicCoachService.kt`

### Frontend
- `TriathlonTeamFE/src/app/features/admin/services/models/admin-coach.model.ts`
- `TriathlonTeamFE/src/app/features/admin/services/admin.service.ts`
- `TriathlonTeamFE/src/app/features/admin/components/coach-form/admin-coach-form.component.ts`
- `TriathlonTeamFE/src/app/features/admin/components/coach-form/admin-coach-form.component.html`
- `TriathlonTeamFE/src/app/features/admin/components/coach-form/admin-coach-form.component.scss`
- `TriathlonTeamFE/src/app/features/admin/components/coaches/admin-coach-list.component.ts`
- `TriathlonTeamFE/src/app/features/admin/components/coaches/admin-coach-list.component.html`
- `TriathlonTeamFE/src/app/features/admin/components/coaches/admin-coach-list.component.scss`
- `TriathlonTeamFE/src/app/features/coaches/components/coaches-list/coaches-list.component.ts`
- `TriathlonTeamFE/src/app/features/coaches/components/coaches-list/coaches-list.component.html`
- `TriathlonTeamFE/src/app/features/coaches/components/coach-profile/coach-profile.component.ts`
- `TriathlonTeamFE/src/app/features/coaches/components/coach-profile/coach-profile.component.html`

## Next Steps

1. Test the complete flow in development environment
2. Apply and run Flyway migration on Railway
3. Verify photo upload and display on production
4. Monitor for any performance issues with large photos
5. Consider adding image optimization/compression in the future

