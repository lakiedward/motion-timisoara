# CORS 403 Error Fix

## Problem
You were experiencing a **403 Forbidden** error on OPTIONS (preflight) requests to your API endpoint. This was causing no response to be received from the backend.

## Root Cause
The CORS configuration had a critical issue:
- `allowCredentials` was set to `true`
- The origin list was falling back to `"*"` (wildcard) when no origins were specified
- **CORS specification does not allow wildcard origins (`*`) when credentials are enabled**

This conflict caused the browser to reject the preflight OPTIONS request with a 403 error.

## Fixes Applied

### 1. Updated SecurityConfig.kt
Fixed the CORS configuration to:
- Remove the wildcard fallback
- Provide specific default origins instead of `"*"`
- Add `exposedHeaders` for proper header visibility
- Add `maxAge` to cache preflight responses (reduces OPTIONS requests)

### 2. Required Action on Railway

**CRITICAL**: You must set the `CORS_ALLOWED_ORIGINS` environment variable in your Railway project.

#### Steps to Fix on Railway:

1. Go to your Railway project dashboard
2. Select your backend service
3. Go to the **Variables** tab
4. Add or update the following environment variable:

```
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

**Important**: Replace `https://your-frontend-domain.com` with your actual frontend URL(s).

#### Multiple Origins Example:
If you have multiple frontend URLs (production, staging, etc.), separate them with commas:

```
CORS_ALLOWED_ORIGINS=https://production-frontend.com,https://staging-frontend.com,https://preview-frontend.com
```

#### Common Frontend URLs:
- If using Vercel: `https://your-app.vercel.app`
- If using Netlify: `https://your-app.netlify.app`
- If using Railway: `https://your-frontend.railway.app`
- Local development: `http://localhost:4200` (already included as fallback)

### 3. Redeploy

After setting the environment variable:
1. Click **Deploy** or trigger a redeploy
2. Wait for the deployment to complete
3. Test your API endpoint

## Testing the Fix

Once deployed, test your login endpoint:

```bash
curl -X OPTIONS https://triathlonteambe-production.up.railway.app/api/auth/login \
  -H "Origin: https://your-frontend-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

You should see:
- **200 OK** status (not 403)
- CORS headers in the response:
  - `Access-Control-Allow-Origin: https://your-frontend-domain.com`
  - `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
  - `Access-Control-Allow-Credentials: true`

## What Changed in Code

**Before:**
```kotlin
configuration.allowedOrigins = if (origins.isEmpty()) mutableListOf("*") else origins.toMutableList()
configuration.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
configuration.allowedHeaders = listOf("*")
configuration.allowCredentials = true
```

**After:**
```kotlin
configuration.allowedOrigins = if (origins.isEmpty()) {
    listOf("http://localhost:4200", "http://localhost:3000")
} else {
    origins
}
configuration.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
configuration.allowedHeaders = listOf("*")
configuration.allowCredentials = true
configuration.exposedHeaders = listOf("Authorization", "Content-Type")
configuration.maxAge = 3600L // Cache preflight response for 1 hour
```

## Additional Benefits

1. **Preflight Caching**: The `maxAge = 3600L` setting caches the preflight response for 1 hour, reducing the number of OPTIONS requests
2. **Exposed Headers**: Properly exposes `Authorization` and `Content-Type` headers to the frontend
3. **Better Security**: No longer uses wildcard origins, which is more secure

## Verification Checklist

- [ ] Code changes committed and pushed
- [ ] `CORS_ALLOWED_ORIGINS` environment variable set on Railway
- [ ] Application redeployed on Railway
- [ ] OPTIONS request returns 200 OK
- [ ] POST request to `/api/auth/login` works from frontend
- [ ] CORS headers are present in response

## If You Still See Issues

1. **Clear browser cache** - Old preflight responses might be cached
2. **Check exact URL** - Make sure the frontend origin in Railway matches exactly (including protocol and port)
3. **Check browser console** - Look for detailed CORS error messages
4. **Verify Railway logs** - Check if the environment variable is being read correctly
5. **Test with curl** - Use the curl command above to isolate browser issues

## Notes

- The default origins (`http://localhost:4200`, `http://localhost:3000`) are only used if `CORS_ALLOWED_ORIGINS` is not set
- For production, **always set `CORS_ALLOWED_ORIGINS`** explicitly
- Do not include trailing slashes in origin URLs
- Origins are case-sensitive and must match exactly
