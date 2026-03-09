# Script to regenerate occurrences for a course
$baseUrl = "http://localhost:8081"
$courseId = "34f866d0-ed18-46ce-acb7-a92d9131f6e1"

# Step 1: Login as admin
Write-Host "Logging in as admin..." -ForegroundColor Cyan
$loginBody = @{
    email = "admin@club.ro"
    password = "Admin!234"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "✓ Login successful!" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Regenerate occurrences
Write-Host "`nRegenerating occurrences for course $courseId..." -ForegroundColor Cyan
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    Invoke-RestMethod -Uri "$baseUrl/api/admin/courses/$courseId/regenerate-occurrences" -Method Post -Headers $headers
    Write-Host "✓ Occurrences regenerated successfully!" -ForegroundColor Green
    Write-Host "`nVineri ar trebui să apară acum în programul cursului." -ForegroundColor Yellow
    Write-Host "Reîmprospătați pagina: http://localhost:4200/cursuri/$courseId" -ForegroundColor Yellow
} catch {
    Write-Host "✗ Failed to regenerate occurrences: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    exit 1
}

