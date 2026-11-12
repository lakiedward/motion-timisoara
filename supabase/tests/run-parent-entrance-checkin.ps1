$ErrorActionPreference = 'Stop'
$migrationFile = Join-Path $PSScriptRoot '../migrations/00042_transactional_attendance.sql'
$startGuardFile = Join-Path $PSScriptRoot '../migrations/00105_attendance_after_session_start.sql'
$entranceFile = Join-Path $PSScriptRoot '../migrations/00142_parent_entrance_checkin.sql'
$containerName = 'motion-entrance-checkin-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$jobs = @()

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-TestSql {
    param([string] $Sql)
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'entrance_checkin_test', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-TestConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $Name, $Sql -ScriptBlock {
        param($Container, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d entrance_checkin_test -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

function Wait-ForLockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d entrance_checkin_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='attendance-first' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated test connections.' }
        if ($active.Trim() -eq '1') { return }
        Start-Sleep -Milliseconds 100
    }
    throw 'The first concurrent transaction did not acquire its lock.'
}

try {
    Invoke-TestDocker -DockerArguments @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=entrance_checkin_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d entrance_checkin_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-TestDocker -DockerArguments @('cp', $migrationFile, "${containerName}:/tmp/transactional-attendance-migration.sql")
    Invoke-TestDocker -DockerArguments @('cp', $startGuardFile, "${containerName}:/tmp/attendance-after-session-start-migration.sql")
    Invoke-TestDocker -DockerArguments @('cp', $entranceFile, "${containerName}:/tmp/parent-entrance-checkin-migration.sql")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot 'parent-entrance-checkin.sql'), "${containerName}:/tmp/parent-entrance-checkin.sql")
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'entrance_checkin_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/parent-entrance-checkin.sql')

    $jobs += Start-TestConnection -Name 'attendance-first' -Sql "SET ROLE authenticated; SELECT public.test_as(2); BEGIN; SELECT public.test_assert(public.test_checkin(100,213)->>'outcome'='recorded','concurrent parent check-in records'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'attendance-second' -Sql "SELECT public.test_assert(public.test_coach_scan(100,213)->>'outcome'='duplicate','concurrent coach scan is duplicate');"
    $jobs | Wait-Job -Timeout 45 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent parent and coach test did not complete.' }
    }
    Invoke-TestSql -Sql "SELECT public.test_assert(public.test_balance(213)='2/1','parent and coach together debit once');"

    $jobs += Start-TestConnection -Name 'attendance-first' -Sql "SET ROLE authenticated; SELECT public.test_as(2); BEGIN; SELECT public.test_assert(public.test_checkin(101,214)->>'outcome'='recorded','first parent check-in records'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'attendance-second' -Sql "SET ROLE authenticated; SELECT public.test_as(2); SELECT public.test_assert(public.test_checkin(102,214)->>'outcome'='duplicate','second parent device is duplicate');"
    $jobs | Wait-Job -Timeout 45 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent parent devices test did not complete.' }
    }
    Invoke-TestSql -Sql "SELECT public.test_assert(public.test_balance(214)='2/1','two parent devices debit once');"
    Write-Output 'All parent entrance check-in SQL and concurrency tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
}
