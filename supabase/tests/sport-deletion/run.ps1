$ErrorActionPreference = 'Stop'
$containerName = 'motion-sport-deletion-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$jobs = @()

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-TestSql {
    param([string] $Sql)
    Invoke-TestDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'sport_deletion_test', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-TestConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $Name, $Sql -ScriptBlock {
        param($Container, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d sport_deletion_test -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

function Wait-ForLockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d sport_deletion_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='sports-first' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated connections.' }
        if ($active.Trim() -eq '1') { return }
        Start-Sleep -Milliseconds 100
    }
    throw 'The first transaction did not acquire its lock.'
}

function Complete-TestConnections {
    $jobs | Wait-Job -Timeout 30 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent sport deletion test did not complete.' }
    }
}

function Wait-ForBlockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d sport_deletion_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='sports-second' AND wait_event_type='Lock'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated connections.' }
        if ($active.Trim() -eq '1') { return }
        Start-Sleep -Milliseconds 100
    }
    throw 'The second transaction did not wait for the concurrent foreign-key lock.'
}

try {
    Invoke-TestDocker @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=sport_deletion_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d sport_deletion_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-TestDocker @('cp', (Join-Path $PSScriptRoot '../../migrations'), "${containerName}:/tmp/migrations")
    Invoke-TestDocker @('cp', (Join-Path $PSScriptRoot 'contract.sql'), "${containerName}:/tmp/sport-deletion.sql")
    Invoke-TestDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'sport_deletion_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/sport-deletion.sql')

    $jobs += Start-TestConnection -Name 'sports-first' -Sql "BEGIN; INSERT INTO public.coach_sports(coach_profile_id,sport_id) VALUES (public.test_uuid(100),public.test_uuid(7)); SELECT pg_sleep(6); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'sports-second' -Sql "SELECT public.test_assert(public.test_try_delete(7)='23503','concurrent coach association blocks deletion');"
    Wait-ForBlockedConnection
    Complete-TestConnections
    Invoke-TestSql "SELECT public.test_assert(EXISTS(SELECT 1 FROM public.sports WHERE id=public.test_uuid(7)) AND EXISTS(SELECT 1 FROM public.coach_sports WHERE sport_id=public.test_uuid(7)),'concurrent sport and association remain intact');"

    $jobs += Start-TestConnection -Name 'sports-first' -Sql "BEGIN; DELETE FROM public.sports WHERE id=public.test_uuid(8); SELECT pg_sleep(6); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'sports-second' -Sql "SELECT public.test_assert(public.test_try_club_sport(8)='23503','association cannot commit after sport deletion');"
    Wait-ForBlockedConnection
    Complete-TestConnections
    Invoke-TestSql "SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.sports WHERE id=public.test_uuid(8)) AND NOT EXISTS(SELECT 1 FROM public.club_sports WHERE sport_id=public.test_uuid(8)),'delete-first race leaves no dangling association');"
    Write-Output 'All isolated sport deletion SQL and concurrency tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
}
