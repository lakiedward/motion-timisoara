#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script pentru rularea testelor E2E Motion Timișoara
    
.DESCRIPTION
    Acest script simplifică rularea testelor Playwright pentru validarea producției.
    Suportă mai multe moduri de rulare și configurare.
    
.PARAMETER Mode
    Modul de rulare: "smoke", "full", "ui", "debug", "local"
    
.PARAMETER Browser
    Browser pentru teste: "chromium", "firefox", "webkit", "all"
    
.EXAMPLE
    .\run-e2e-tests.ps1 -Mode smoke
    Rulează doar smoke tests (rapid)
    
.EXAMPLE
    .\run-e2e-tests.ps1 -Mode full -Browser chromium
    Rulează toate testele în Chrome
    
.EXAMPLE
    .\run-e2e-tests.ps1 -Mode local
    Rulează testele împotriva localhost
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("smoke", "full", "ui", "debug", "local", "report")]
    [string]$Mode = "smoke",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("chromium", "firefox", "webkit", "all")]
    [string]$Browser = "chromium"
)

# Culori pentru output
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }

# Header
Write-Host "`n================================================" -ForegroundColor Magenta
Write-Host "   Motion Timișoara - E2E Test Runner" -ForegroundColor Magenta
Write-Host "================================================`n" -ForegroundColor Magenta

# Verifică că Playwright este instalat
Write-Info "Verificare Playwright..."
$playwrightInstalled = Get-Command npx -ErrorAction SilentlyContinue
if (-not $playwrightInstalled) {
    Write-Error "npx nu este instalat. Instalează Node.js și încearcă din nou."
    exit 1
}

# Verifică că suntem în directorul corect
if (-not (Test-Path "playwright.config.ts")) {
    Write-Error "playwright.config.ts nu a fost găsit. Rulează scriptul din directorul root al proiectului."
    exit 1
}

Write-Success "Playwright găsit!"

# Construiește comanda de test
$testCommand = "npx playwright test"

# Configurează browser
if ($Browser -ne "all") {
    $testCommand += " --project=$Browser"
    Write-Info "Browser selectat: $Browser"
}

switch ($Mode) {
    "smoke" {
        Write-Info "Mod: Smoke Tests (verificare rapidă)"
        $testCommand += " smoke-tests"
        Write-Host "`n📋 Rulează smoke tests pentru verificare rapidă...`n" -ForegroundColor Yellow
    }
    
    "full" {
        Write-Info "Mod: Full Test Suite"
        Write-Host "`n📋 Rulează toate testele de producție...`n" -ForegroundColor Yellow
    }
    
    "ui" {
        Write-Info "Mod: UI Mode (interactiv)"
        $testCommand = "npx playwright test --ui"
        Write-Host "`n🎨 Deschide UI Mode pentru debugging interactiv...`n" -ForegroundColor Yellow
    }
    
    "debug" {
        Write-Info "Mod: Debug Mode"
        $testCommand = "npx playwright test --debug"
        Write-Host "`n🐛 Deschide Debug Mode...`n" -ForegroundColor Yellow
    }
    
    "local" {
        Write-Info "Mod: Local Development"
        $env:BASE_URL = "http://localhost:4200"
        Write-Warning "BASE_URL setat la: http://localhost:4200"
        Write-Warning "Asigură-te că:"
        Write-Host "  1. Backend rulează pe http://localhost:8081" -ForegroundColor Gray
        Write-Host "  2. Frontend rulează pe http://localhost:4200" -ForegroundColor Gray
        Write-Host "  3. api-base-url în index.html pointează la localhost`n" -ForegroundColor Gray
        
        Write-Host "Continuă în 3 secunde..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
    
    "report" {
        Write-Info "Mod: Vizualizare Raport"
        Write-Host "`n📊 Deschide raportul HTML...`n" -ForegroundColor Yellow
        npx playwright show-report
        exit 0
    }
}

# Afișează comanda care va fi rulată
Write-Host "`n🚀 Comandă: " -ForegroundColor Cyan -NoNewline
Write-Host "$testCommand`n" -ForegroundColor White

# Rulează testele
$startTime = Get-Date
try {
    Invoke-Expression $testCommand
    $exitCode = $LASTEXITCODE
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "`n================================================" -ForegroundColor Magenta
    
    if ($exitCode -eq 0) {
        Write-Success "Toate testele au trecut!"
        Write-Host "⏱️  Durată: $([math]::Round($duration, 2)) secunde" -ForegroundColor Cyan
        Write-Host "`n📊 Pentru raport detaliat, rulează: .\run-e2e-tests.ps1 -Mode report" -ForegroundColor Gray
    } else {
        Write-Error "Unele teste au eșuat!"
        Write-Host "⏱️  Durată: $([math]::Round($duration, 2)) secunde" -ForegroundColor Cyan
        Write-Host "`n🐛 Pentru debugging:" -ForegroundColor Yellow
        Write-Host "  - Screenshots în: test-results/" -ForegroundColor Gray
        Write-Host "  - Rulează: .\run-e2e-tests.ps1 -Mode ui" -ForegroundColor Gray
        Write-Host "  - Rulează: .\run-e2e-tests.ps1 -Mode debug" -ForegroundColor Gray
    }
    
    Write-Host "================================================`n" -ForegroundColor Magenta
    exit $exitCode
    
} catch {
    Write-Error "Eroare la rularea testelor: $_"
    exit 1
}
