# ✅ CORS 403 Error - FIXED

## The Problem You Had

```
Request URL: https://triathlonteambe-production.up.railway.app/api/auth/login
Request Method: OPTIONS
Status Code: 403 Forbidden
Response: (empty - no response received)
```

## The Solution

Your CORS configuration was trying to use wildcard origin (`*`) with credentials enabled, which is forbidden by the CORS specification.

### Code Changes Made ✓

Modified `src/main/kotlin/com/club/triathlon/config/SecurityConfig.kt`:

```kotlin
// BEFORE (Broken):
configuration.allowedOrigins = if (origins.isEmpty()) mutableListOf("*") else origins.toMutableList()

// AFTER (Fixed):
configuration.allowedOrigins = if (origins.isEmpty()) {
    listOf("http://localhost:4200", "http://localhost:3000")
} else {
    origins
}

// Also added:
configuration.exposedHeaders = listOf("Authorization", "Content-Type")
configuration.maxAge = 3600L // Cache preflight for 1 hour
```

## 🚨 ACTION REQUIRED: Configure Railway

### You MUST do this now:

1. **Go to Railway Dashboard**: https://railway.app
2. **Select your backend service**: `triathlonteambe-production`
3. **Go to Variables tab**
4. **Add this environment variable**:

```
CORS_ALLOWED_ORIGINS=https://your-actual-frontend-url.com
```

5. **Replace** `https://your-actual-frontend-url.com` with your real frontend URL
6. **Save** and wait for automatic redeploy

### Multiple Frontend URLs?

Use commas (no spaces):
```
CORS_ALLOWED_ORIGINS=https://app.domain.com,https://www.domain.com,https://staging.domain.com
```

## Testing Your Fix

### Option 1: Use the test script
```bash
./test-cors.sh https://triathlonteambe-production.up.railway.app https://your-frontend-url.com
```

### Option 2: Manual curl test
```bash
curl -X OPTIONS https://triathlonteambe-production.up.railway.app/api/auth/login \
  -H "Origin: https://your-frontend-url.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

### What You Should See:
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: https://your-frontend-url.com
< Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
< Access-Control-Allow-Credentials: true
< Access-Control-Max-Age: 3600
```

## Verification Checklist

- [x] Code fixed and compiled successfully
- [ ] Set `CORS_ALLOWED_ORIGINS` on Railway ← **YOU ARE HERE**
- [ ] Application redeployed
- [ ] Test with curl - returns 200 OK
- [ ] Test from frontend - login works
- [ ] Browser console - no CORS errors

## Documentation

- `CORS_FIX_SUMMARY.md` - Quick reference
- `CORS_FIX.md` - Detailed documentation with troubleshooting
- `RAILWAY.md` - Updated with CORS requirements
- `test-cors.sh` - Automated testing script

## Still Having Issues?

1. **Check the exact URL**: Protocol (http/https) and domain must match EXACTLY
2. **No trailing slashes**: Use `https://domain.com` NOT `https://domain.com/`
3. **Clear browser cache**: Old preflight responses may be cached
4. **Check Railway logs**: Verify the environment variable is loaded
5. **Wait for deployment**: Give Railway a few minutes after setting variables

## Why This Happened

The Spring Boot CORS configuration was falling back to wildcard (`*`) when `CORS_ALLOWED_ORIGINS` wasn't set. However, when `allowCredentials = true` (which is needed for authentication), the CORS spec explicitly forbids wildcard origins. This caused the browser to reject all OPTIONS preflight requests with 403 Forbidden.

## The Fix in Plain English

Instead of allowing "any origin" (which doesn't work with credentials), the backend now:
1. Requires specific origins to be configured
2. Uses sensible defaults for local development
3. Properly exposes headers
4. Caches preflight responses to reduce overhead

**Now go set that environment variable on Railway! 🚀**
