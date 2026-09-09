$ErrorActionPreference = 'Stop'
$containerName = 'motion-live-location-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$database = 'live_location_test'
$jobs = @()

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-TestSql {
    param([string] $Sql)
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-TestConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $database, $Name, $Sql -ScriptBlock {
        param($Container, $DatabaseName, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d $DatabaseName -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

function Wait-ForLockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d $database -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='live-location-first' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated test connections.' }
        if ($active.Trim() -eq '1') { return }
        Start-Sleep -Milliseconds 100
    }
    throw 'The first concurrent transaction did not acquire its lock.'
}

function Wait-ForTestConnections {
    $jobs | Wait-Job -Timeout 45 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent location test did not complete.' }
    }
}

try {
    Invoke-TestDocker -DockerArguments @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', "POSTGRES_DB=$database", $image, 'postgres', '-D', '/var/lib/postgresql/data', '-c', 'shared_preload_libraries=pg_cron', '-c', "cron.database_name=$database", '-c', 'cron.launch_active_jobs=off')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d $database *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot '../migrations/00042_transactional_attendance.sql'), "${containerName}:/tmp/transactional-attendance-migration.sql")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot '../migrations/00043_coach_live_location.sql'), "${containerName}:/tmp/coach-live-location-migration.sql")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot 'coach-live-location.sql'), "${containerName}:/tmp/coach-live-location.sql")
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/coach-live-location.sql')

    $jobs += Start-TestConnection -Name 'live-location-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_live(1,'stop',106,public.test_session(106))->>'success'='true','concurrent stop succeeds'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'live-location-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_live(1,'update',106,(SELECT jsonb_build_object('sessionId',id) FROM public.test_concurrent_session)||public.test_point())->>'code'='SESSION_NOT_FOUND','update waiting for stop cannot resurrect point');"
    Wait-ForTestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions WHERE occurrence_id=public.test_uuid(106)) AND NOT EXISTS(SELECT FROM public.coach_live_locations),'stop wins against delayed update'); SET ROLE service_role; SELECT public.test_live(1,'start',106,jsonb_build_object('consent',true));"

    $jobs += Start-TestConnection -Name 'live-location-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_live(1,'update',106,public.test_session(106)||public.test_point())->>'success'='true','concurrent update succeeds first'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'live-location-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_live(1,'stop',106,public.test_session(106))->>'success'='true','stop waiting for update succeeds');"
    Wait-ForTestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions WHERE occurrence_id=public.test_uuid(106)) AND NOT EXISTS(SELECT FROM public.coach_live_locations),'stop removes a concurrently completed point'); SELECT count(*) AS passed_assertions FROM public.test_results;"
    Write-Output 'All isolated SQL and concurrent coach live location tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
}
