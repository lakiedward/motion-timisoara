$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'run-coach-live-location.ps1') -WithRealtime
if ($LASTEXITCODE -ne 0) { throw 'Isolated live location Realtime SQL checks failed.' }
