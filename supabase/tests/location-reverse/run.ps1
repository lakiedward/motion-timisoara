$ErrorActionPreference = 'Stop'
$containerName = 'motion-location-reverse-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$jobs = @()
function Run-Docker {
  param([string[]] $Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Isolated SQL command failed.' }
}
try {
  Run-Docker @('run','--detach','--name',$containerName,'--network','none','--env','POSTGRES_PASSWORD=local-test-only','--env','POSTGRES_DB=location_reverse_test',$image,'postgres','-D','/var/lib/postgresql/data')
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d location_reverse_test *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'PostgreSQL did not become ready.' }
  Run-Docker @('cp',(Join-Path $PSScriptRoot '../../migrations/00084_location_reverse_cache.sql'),"${containerName}:/tmp/migration.sql")
  Run-Docker @('cp',(Join-Path $PSScriptRoot '../../migrations/00085_location_reverse_provider.sql'),"${containerName}:/tmp/provider.sql")
  Run-Docker @('cp',(Join-Path $PSScriptRoot 'contract.sql'),"${containerName}:/tmp/contract.sql")
  Run-Docker @('exec',$containerName,'psql','-X','-U','supabase_admin','-d','location_reverse_test','-v','ON_ERROR_STOP=1','-f','/tmp/contract.sql')
  foreach ($connection in 1..2) {
    $jobs += Start-Job -ArgumentList $containerName -ScriptBlock {
      param($testContainer)
      $claim = & docker exec $testContainer psql -X -U supabase_admin -d location_reverse_test -At -c "SELECT public.claim_location_reverse('46.00000,22.00000')->>'token';"
      if ($LASTEXITCODE -ne 0) { throw 'Concurrent claim failed.' }
      return $claim
    }
  }
  $jobs | Wait-Job -Timeout 30 | Out-Null
  $claims = @($jobs | Receive-Job -ErrorAction Stop | Where-Object { $_ -match '^[0-9a-f-]{36}$' })
  if (@($jobs | Where-Object State -ne 'Completed').Count -gt 0 -or $claims.Count -ne 1) { throw 'Concurrent callers did not share one exclusive lease.' }
  Write-Output 'Concurrent claims: exactly one provider lease granted.'
} finally {
  $jobs | Stop-Job -ErrorAction SilentlyContinue
  $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
  & docker rm -f $containerName *> $null
}
