# CORS 403 Error - Fixed! ✓

## What Was Wrong

Your backend was returning **403 Forbidden** on OPTIONS requests because:
- CORS configuration tried to use wildcard origin (`*`) with `allowCredentials: true`
- This is **not allowed** by CORS specification
- The browser blocked the preflight request, giving you no response

## What Was Fixed

✓ Updated `SecurityConfig.kt` to properly handle CORS:
- Removed wildcard origin fallback
- Added default origins for local development
- Added `exposedHeaders` configuration
- Added `maxAge` for preflight caching (1 hour)

## What You Need to Do NOW on Railway

### Step 1: Set Environment Variable

1. Go to https://railway.app/project/YOUR-PROJECT
2. Select your backend service
3. Click on **Variables** tab
4. Add this variable:

```
Name: CORS_ALLOWED_ORIGINS
Value: https://your-frontend-url.com
```

**Replace `https://your-frontend-url.com` with your ACTUAL frontend URL!**

### Step 2: Redeploy

After adding the variable, Railway should automatically redeploy. If not:
1. Go to **Deployments** tab
2. Click on the three dots next to the latest deployment
3. Select **Redeploy**

### Step 3: Test

Run the test script:
```bash
./test-cors.sh https://triathlonteambe-production.up.railway.app https://your-frontend-url.com
```

Or test manually in your browser by trying to login from your frontend.

## Quick Test Commands

### Test OPTIONS request (should return 200 OK):
```bash
curl -X OPTIONS https://triathlonteambe-production.up.railway.app/api/auth/login \
  -H "Origin: https://your-frontend-url.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

### Expected Response Headers:
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://your-frontend-url.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 3600
```

## Files Changed

1. ✓ `/workspace/src/main/kotlin/com/club/triathlon/config/SecurityConfig.kt`
   - Fixed CORS configuration
   
2. ✓ `/workspace/CORS_FIX.md`
   - Detailed documentation of the fix
   
3. ✓ `/workspace/RAILWAY.md`
   - Updated with CORS requirements
   
4. ✓ `/workspace/test-cors.sh`
   - Testing script to verify CORS

## Common Issues

### Still getting 403?
- Make sure you set `CORS_ALLOWED_ORIGINS` on Railway
- Make sure the URL matches EXACTLY (including https://)
- Redeploy after setting the variable

### Frontend URL examples:
- Vercel: `https://your-app.vercel.app`
- Netlify: `https://your-app.netlify.app`
- Railway: `https://your-frontend.railway.app`
- Custom domain: `https://www.your-domain.com`

### Multiple URLs?
Separate with commas, NO SPACES:
```
CORS_ALLOWED_ORIGINS=https://app.domain.com,https://www.domain.com,https://preview.domain.com
```

## Need More Help?

1. Read `CORS_FIX.md` for detailed troubleshooting
2. Run `./test-cors.sh` to diagnose issues
3. Check Railway logs for errors
4. Verify environment variables in Railway dashboard

## Summary

✓ Code fixed  
⏳ Waiting for you to set `CORS_ALLOWED_ORIGINS` on Railway  
⏳ Waiting for redeploy  
⏳ Ready to test!

**Action required: Set the environment variable on Railway NOW!**
