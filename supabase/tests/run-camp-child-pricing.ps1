$ErrorActionPreference = 'Stop'
$migrationRoot = Join-Path $PSScriptRoot '../migrations'
$source = Get-Content -LiteralPath (Join-Path $migrationRoot '00037_camp_age_pricing.sql') -Raw
$functionStart = $source.IndexOf('CREATE OR REPLACE FUNCTION public.varsta_la_data(')
if ($functionStart -lt 0) {
    throw 'Cannot locate the original camp pricing functions in migration 00037.'
}

$runId = [Guid]::NewGuid().ToString('N')
$containerName = "motion-camp-pricing-$runId"
$functionFile = Join-Path ([IO.Path]::GetTempPath()) "motion-camp-pricing-$runId.sql"
$image = 'public.ecr.aws/supabase/postgres:17.6.1.063'

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE."
    }
}

try {
    [IO.File]::WriteAllText($functionFile, $source.Substring($functionStart))
    Invoke-TestDocker -DockerArguments @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=camp_pricing_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d camp_pricing_test *> $null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        throw 'Isolated PostgreSQL did not become ready within 30 seconds.'
    }
    Invoke-TestDocker -DockerArguments @('cp', $functionFile, "${containerName}:/tmp/camp-pricing-functions.sql")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $migrationRoot '00041_camp_child_price_server_only.sql'), "${containerName}:/tmp/camp-pricing-restriction.sql")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot 'camp-child-pricing.sql'), "${containerName}:/tmp/camp-child-pricing.sql")
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'camp_pricing_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/camp-child-pricing.sql')
} finally {
    & docker rm --force --volumes $containerName *> $null
    if (Test-Path -LiteralPath $functionFile) {
        Remove-Item -LiteralPath $functionFile
    }
}
