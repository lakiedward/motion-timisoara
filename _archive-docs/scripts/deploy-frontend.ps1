# Deploy Frontend to Railway - Quick Start Script
# This script helps you deploy the frontend with the correct configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Motion Timișoara - Frontend Deploy  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "TriathlonTeamFE")) {
    Write-Host "❌ Error: TriathlonTeamFE directory not found!" -ForegroundColor Red
    Write-Host "   Please run this script from the project root." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Directory structure verified" -ForegroundColor Green
Write-Host ""

# Check Git status
Write-Host "📋 Checking Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host ""
    Write-Host "📝 You have uncommitted changes:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    
    $commit = Read-Host "Do you want to commit these changes? (y/n)"
    
    if ($commit -eq "y" -or $commit -eq "Y") {
        Write-Host ""
        $message = Read-Host "Enter commit message"
        
        git add .
        git commit -m "$message"
        
        Write-Host "✅ Changes committed" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Skipping commit..." -ForegroundColor Yellow
    }
}
else {
    Write-Host "✅ No uncommitted changes" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Pushed to GitHub successfully" -ForegroundColor Green
}
else {
    Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps - Railway Configuration  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Go to Railway Dashboard:" -ForegroundColor White
Write-Host "   https://railway.app" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. Create a new service from your GitHub repo" -ForegroundColor White
Write-Host ""

Write-Host "3. Configure the service:" -ForegroundColor White
Write-Host "   - Name: motion-timisoara-frontend" -ForegroundColor Gray
Write-Host "   - Root Directory: TriathlonTeamFE" -ForegroundColor Gray
Write-Host "   - Railway will auto-detect Dockerfile" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Add custom domains:" -ForegroundColor White
Write-Host "   - motiontimisoara.com" -ForegroundColor Gray
Write-Host "   - www.motiontimisoara.com" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Configure DNS on Namecheap:" -ForegroundColor White
Write-Host "   https://ap.www.namecheap.com/domains/domaincontrolpanel/motiontimisoara.com/domain" -ForegroundColor Cyan
Write-Host ""

Write-Host "6. Update Backend CORS on Railway:" -ForegroundColor White
Write-Host "   Add variable: CORS_ALLOWED_ORIGINS" -ForegroundColor Gray
Write-Host "   (Already configured in application.yml)" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📖 For detailed instructions, see:" -ForegroundColor White
Write-Host "   - DOMAIN_SETUP_GUIDE.md (Complete guide)" -ForegroundColor Cyan
Write-Host "   - TriathlonTeamFE/RAILWAY_DEPLOYMENT.md (Railway specific)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✨ Done! Your code is ready for deployment." -ForegroundColor Green

