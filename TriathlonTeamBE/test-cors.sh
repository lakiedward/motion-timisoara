#!/bin/bash

# CORS Testing Script for Triathlon Team Backend
# Usage: ./test-cors.sh <your-backend-url> <your-frontend-origin>
# Example: ./test-cors.sh https://triathlonteambe-production.up.railway.app https://your-frontend.com

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <backend-url> [frontend-origin]"
    echo "Example: $0 https://triathlonteambe-production.up.railway.app https://your-frontend.com"
    exit 1
fi

BACKEND_URL=$1
FRONTEND_ORIGIN=${2:-"https://your-frontend.com"}

echo "=========================================="
echo "Testing CORS Configuration"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo "Frontend Origin: $FRONTEND_ORIGIN"
echo ""

echo "Testing OPTIONS preflight request to /api/auth/login..."
echo ""

response=$(curl -X OPTIONS "$BACKEND_URL/api/auth/login" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -i -s)

echo "$response"
echo ""
echo "=========================================="

# Check for success
if echo "$response" | grep -q "HTTP/[0-9.]* 200"; then
    echo "✓ SUCCESS: OPTIONS request returned 200 OK"
elif echo "$response" | grep -q "HTTP/[0-9.]* 204"; then
    echo "✓ SUCCESS: OPTIONS request returned 204 No Content"
else
    echo "✗ FAILED: OPTIONS request did not return 200/204"
fi

# Check for required CORS headers
echo ""
echo "Checking CORS Headers:"
echo "----------------------"

if echo "$response" | grep -qi "Access-Control-Allow-Origin"; then
    origin=$(echo "$response" | grep -i "Access-Control-Allow-Origin" | cut -d' ' -f2-)
    echo "✓ Access-Control-Allow-Origin: $origin"
else
    echo "✗ Missing: Access-Control-Allow-Origin"
fi

if echo "$response" | grep -qi "Access-Control-Allow-Methods"; then
    methods=$(echo "$response" | grep -i "Access-Control-Allow-Methods" | cut -d' ' -f2-)
    echo "✓ Access-Control-Allow-Methods: $methods"
else
    echo "✗ Missing: Access-Control-Allow-Methods"
fi

if echo "$response" | grep -qi "Access-Control-Allow-Credentials"; then
    creds=$(echo "$response" | grep -i "Access-Control-Allow-Credentials" | cut -d' ' -f2-)
    echo "✓ Access-Control-Allow-Credentials: $creds"
else
    echo "✗ Missing: Access-Control-Allow-Credentials"
fi

if echo "$response" | grep -qi "Access-Control-Max-Age"; then
    maxage=$(echo "$response" | grep -i "Access-Control-Max-Age" | cut -d' ' -f2-)
    echo "✓ Access-Control-Max-Age: $maxage"
else
    echo "⚠ Missing: Access-Control-Max-Age (optional but recommended)"
fi

echo ""
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. If you see 403 or missing CORS headers:"
echo "   - Make sure CORS_ALLOWED_ORIGINS is set on Railway"
echo "   - Verify the origin matches exactly (including protocol)"
echo "   - Redeploy the application after setting variables"
echo ""
echo "2. Test an actual POST request from your frontend"
echo ""
echo "3. Check browser console for any remaining CORS errors"
echo "=========================================="
