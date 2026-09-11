$ErrorActionPreference = 'Stop'
$migrationFile = Join-Path $PSScriptRoot '../migrations'
$containerName = 'motion-payment-completion-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$jobs = @()

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-TestSql {
    param([string] $Sql)
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'payment_completion_test', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-TestConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $Name, $Sql -ScriptBlock {
        param($Container, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d payment_completion_test -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

function Wait-ForLockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d payment_completion_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='payment-first' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated test connections.' }
        if ($active.Trim() -eq '1') { return }
        Start-Sleep -Milliseconds 100
    }
    throw 'The first concurrent transaction did not acquire its lock.'
}

try {
    Invoke-TestDocker -DockerArguments @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=payment_completion_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d payment_completion_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-TestDocker -DockerArguments @('cp', $migrationFile, "${containerName}:/tmp/migrations")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot 'enrollment-payment-completion.sql'), "${containerName}:/tmp/enrollment-payment-completion.sql")
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'payment_completion_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/enrollment-payment-completion.sql')

    $jobs += Start-TestConnection -Name 'payment-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_complete(5)->>'changed'='true','first confirmation'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'payment-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_complete(5)->>'changed'='false','duplicate confirmation');"
    $jobs | Wait-Job -Timeout 45 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent payment test did not complete.' }
    }
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT remaining_sessions=10 AND purchased_sessions=10 FROM public.enrollments WHERE id=public.test_uuid(1005)),'concurrent payment credits once');"
    Write-Output 'All isolated payment completion and concurrency tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
}
