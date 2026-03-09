# Quick Debug Guide for 403 Errors

## What Changed

You now get **detailed error messages** instead of empty responses for 403/401 errors!

## Immediate Next Steps

### 1. Deploy to Railway

```powershell
cd TriathlonTeamBE
.\gradlew.bat build -x test
git add .
git commit -m "Fix: Add detailed error responses for 403/401"
git push
```

Railway will auto-deploy in ~2-3 minutes.

### 2. Test Again

Make the same request to:
```
POST https://triathlonteambe-production.up.railway.app/api/admin/coaches/invite
```

You should now see a response body like:

**If you're not authenticated (missing/invalid token):**
```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "Authentication failed: Invalid or missing token",
  "path": "/api/admin/coaches/invite",
  "timestamp": "..."
}
```

**If you lack the ADMIN role:**
```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied: You don't have permission to access this resource",
  "path": "/api/admin/coaches/invite",
  "timestamp": "..."
}
```

### 3. Check Your Token

Decode your JWT token at https://jwt.io and verify:

```json
{
  "sub": "admin@test.com",
  "role": "ADMIN",  ← Must be "ADMIN"
  "iat": 1759911463,
  "exp": 1759918663  ← Must be in the future
}
```

**Important:** The `exp` (expiration) timestamp in your token is `1759918663`, which is:
```
Timestamp: 1759918663
Date: Wed Oct 08 2025 11:11:03 GMT+0300
```

If the current time is past this, your token is **expired**. Get a new one by logging in again.

### 4. Verify User in Database

Check if your user has the ADMIN role in the production database:

**Via Railway Dashboard:**
1. Go to Railway → PostgreSQL service
2. Click "Data" tab
3. Run query:
```sql
SELECT email, role, enabled FROM users WHERE email = 'admin@test.com';
```

Expected result:
- `role`: `ADMIN` (not `PARENT` or `COACH`)
- `enabled`: `true`

### 5. Check Railway Logs

Monitor logs in real-time:
1. Railway Dashboard → TriathlonTeamBE service
2. Click "Deployments" → Latest → "View Logs"
3. Make your request
4. Look for authentication logs:

```
DEBUG c.c.t.s.JwtAuthenticationFilter - Successfully authenticated user: admin@test.com with authorities: [ROLE_ADMIN]
```

Or errors like:
```
WARN  c.c.t.s.JwtAuthenticationFilter - Token validation failed for user: admin@test.com
ERROR c.c.t.s.JwtAuthenticationFilter - Error loading user details for username: admin@test.com
```

## Common Issues & Solutions

### Issue: Token expired (exp is in the past)
**Solution:** Login again to get a new token
```bash
POST https://triathlonteambe-production.up.railway.app/api/auth/login
{
  "email": "admin@test.com",
  "password": "your-password"
}
```

### Issue: User has wrong role in database
**Solution:** Update the user role
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@test.com';
```

### Issue: User account is disabled
**Solution:** Enable the account
```sql
UPDATE users SET enabled = true WHERE email = 'admin@test.com';
```

### Issue: User doesn't exist in production database
**Solution:** Create admin user via DevDataInitializer or manually:
1. Register via `/api/auth/register` endpoint
2. Then update role to ADMIN in database

## Testing Locally First

Before deploying, test locally to isolate issues:

```powershell
# Terminal 1: Start backend
cd TriathlonTeamBE
.\gradlew.bat bootRun

# Terminal 2: Test with curl or Postman
curl -X POST http://localhost:8081/api/admin/coaches/invite \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Coach",
    "email": "coach@test.com",
    "password": "password123",
    "phone": "1234567890",
    "bio": "Test bio",
    "sports": "Swimming"
  }'
```

## What Each Error Means

| Status | Error | Meaning | Solution |
|--------|-------|---------|----------|
| 401 | Unauthorized | Token missing, invalid, or expired | Get new token via login |
| 403 | Forbidden | Authenticated but wrong role | Check user has ADMIN role |
| 409 | Conflict | Email already exists | Use different email |
| 400 | Bad Request | Validation failed | Check request body format |

## Need More Help?

1. **Check application.yml** - Verify JWT settings:
   - `app.jwt.secret` (must match between environments)
   - `app.jwt.expiration-minutes` (default: 120 minutes)

2. **Environment Variables on Railway:**
   - `APP_JWT_SECRET` - JWT signing secret
   - `APP_JWT_EXPIRATION_MINUTES` - Token lifetime
   - `SPRING_DATASOURCE_URL` - Database connection
   - `APP_CORS_ALLOWED_ORIGINS` - CORS settings

3. **Database Connection:**
   - Verify Railway PostgreSQL is running
   - Check connection string in environment variables
   - Ensure Flyway migrations have run (if enabled)


