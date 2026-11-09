$ErrorActionPreference = 'Stop'
$containerName = 'motion-stripe-guard-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'

function Invoke-StripeGuardDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

try {
    Invoke-StripeGuardDocker @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=stripe_guard_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d stripe_guard_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-StripeGuardDocker @('cp', (Join-Path $PSScriptRoot '../migrations'), "${containerName}:/tmp/migrations")
    Invoke-StripeGuardDocker @('cp', (Join-Path $PSScriptRoot 'stripe-connect-columns-guard.sql'), "${containerName}:/tmp/test.sql")
    Invoke-StripeGuardDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'stripe_guard_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/test.sql')
} finally {
    & docker rm --force --volumes $containerName *> $null
}
