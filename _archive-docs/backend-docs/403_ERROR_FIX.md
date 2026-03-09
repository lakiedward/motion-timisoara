# 403 Forbidden Error Fix - Detailed Response Body

## Problem

When making API requests that resulted in 403 Forbidden errors, the backend was returning **no response body**, making it impossible to debug the issue. This is a common problem with Spring Security's default behavior.

Example:
```
POST /api/admin/coaches/invite
Status: 403 Forbidden
Response Body: (empty)
```

## Root Cause

Spring Security's default `AccessDeniedHandler` and `AuthenticationEntryPoint` return empty responses when:
1. A user is authenticated but lacks the required role (403 - Access Denied)
2. A user is not authenticated or has an invalid token (401 - Unauthorized)

Since these errors occur at the **Security Filter Chain level** (before reaching your controllers), the `@RestControllerAdvice` exception handlers never get invoked.

## Solution

Created custom handlers that return proper JSON error responses:

### 1. Custom Access Denied Handler (`CustomAccessDeniedHandler.kt`)
Handles 403 Forbidden errors when an authenticated user lacks the required role:

```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied: You don't have permission to access this resource",
  "path": "/api/admin/coaches/invite",
  "timestamp": "2025-10-08T08:18:55.123Z"
}
```

### 2. Custom Authentication Entry Point (`CustomAuthenticationEntryPoint.kt`)
Handles 401 Unauthorized errors when authentication fails:

```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "Authentication failed: Invalid or missing token",
  "path": "/api/admin/coaches/invite",
  "timestamp": "2025-10-08T08:18:55.123Z"
}
```

### 3. Enhanced JWT Authentication Filter
Added comprehensive logging to help debug authentication issues:
- Logs successful authentication with user details and roles
- Logs token validation failures
- Logs user loading errors
- Logs missing or invalid tokens

### 4. Updated Security Configuration
Integrated the custom handlers into the security filter chain:

```kotlin
.exceptionHandling {
    it.accessDeniedHandler(customAccessDeniedHandler)
    it.authenticationEntryPoint(customAuthenticationEntryPoint)
}
```

## Common Causes of 403 Errors on `/api/admin/coaches/invite`

Now that you'll get proper error messages, here are the typical causes:

### 1. **User doesn't have ADMIN role**
The endpoint requires `@PreAuthorize("hasRole('ADMIN')")`. Check your user in the database:

```sql
SELECT id, email, role, enabled FROM users WHERE email = 'admin@test.com';
```

Expected: `role = 'ADMIN'` and `enabled = true`

### 2. **Token expired**
Your JWT token has expired. Check the token claims:
- `exp` (expiration): Should be in the future
- Default expiration: Set in `application.yml` as `app.jwt.expiration-minutes`

### 3. **Wrong JWT secret**
The production backend uses a different JWT secret than your local environment. Tokens generated locally won't work in production unless the secrets match.

### 4. **User account disabled**
Check if `enabled = false` in the users table.

## Deployment to Railway

After building locally, deploy to Railway:

```powershell
# Build the project
cd TriathlonTeamBE
.\gradlew.bat build -x test

# Commit and push changes
git add .
git commit -m "Add custom error handlers for 403/401 responses"
git push

# Railway will automatically deploy
```

## Checking Logs on Railway

To see the detailed logs with the new authentication debugging:

1. Go to Railway dashboard: https://railway.app
2. Select your `TriathlonTeamBE` service
3. Click on "Deployments" → Latest deployment → "View Logs"

Look for log messages like:
```
DEBUG c.c.t.s.JwtAuthenticationFilter - Successfully authenticated user: admin@test.com with authorities: [ROLE_ADMIN]
WARN  c.c.t.s.JwtAuthenticationFilter - Token validation failed for user: admin@test.com
ERROR c.c.t.s.JwtAuthenticationFilter - Error loading user details for username: admin@test.com
```

## Testing the Fix

Once deployed, retry your request. You should now receive a proper error response:

**Before:**
```
Status: 403
Body: (empty)
```

**After (if user lacks ADMIN role):**
```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied: You don't have permission to access this resource",
  "path": "/api/admin/coaches/invite",
  "timestamp": "2025-10-08T08:30:00.000Z"
}
```

**After (if token is invalid/expired):**
```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "Authentication failed: Invalid or missing token",
  "path": "/api/admin/coaches/invite",
  "timestamp": "2025-10-08T08:30:00.000Z"
}
```

## Verifying Your Admin User

To check your admin user in the production database, use Railway's database console or connect via psql:

```sql
-- Check if admin user exists and has correct role
SELECT id, email, name, role, enabled, created_at 
FROM users 
WHERE email = 'admin@test.com';

-- Should return:
-- role: ADMIN
-- enabled: true
```

If the user doesn't exist or has wrong role, you can fix it:

```sql
-- Update existing user to ADMIN
UPDATE users 
SET role = 'ADMIN', enabled = true 
WHERE email = 'admin@test.com';

-- Or create new admin user (requires bcrypt-hashed password)
-- Use the /api/auth/register endpoint first, then update the role
```

## Files Modified

1. `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/security/CustomAccessDeniedHandler.kt` (new)
2. `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/security/CustomAuthenticationEntryPoint.kt` (new)
3. `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/config/SecurityConfig.kt` (updated)
4. `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/security/JwtAuthenticationFilter.kt` (updated)

## Next Steps

1. **Deploy to Railway** - Push the changes and wait for automatic deployment
2. **Check logs** - Monitor Railway logs during the next failed request
3. **Verify admin user** - Ensure the user in the database has ADMIN role
4. **Test locally first** - Start the backend locally and test with your admin token


