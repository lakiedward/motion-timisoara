$ErrorActionPreference = 'Stop'
$migrationRoot = Join-Path $PSScriptRoot '../../migrations'
$containerName = 'motion-coach-invitation-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$jobs = @()

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-TestSql {
    param([string] $Sql)
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'coach_invitation_test', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-TestConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $Name, $Sql -ScriptBlock {
        param($Container, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d coach_invitation_test -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

function Wait-ForLockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d coach_invitation_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='invitation-first' AND wait_event='PgSleep'"
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
        if ($testJob.State -ne 'Completed') { throw 'Concurrent invitation test did not complete.' }
    }
}

try {
    Invoke-TestDocker -DockerArguments @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=coach_invitation_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d coach_invitation_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-TestDocker -DockerArguments @('cp', $migrationRoot, "${containerName}:/tmp/migrations")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot 'contract.sql'), "${containerName}:/tmp/coach-invitation.sql")
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'coach_invitation_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/coach-invitation.sql')

    $jobs += Start-TestConnection -Name 'invitation-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_try_redeem(30,'ONE-USE')='OK','first claimant succeeds'); SELECT pg_sleep(3); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'invitation-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_try_redeem(31,'ONE-USE')='INVITATION_EXHAUSTED','second concurrent claimant denied');"
    Complete-TestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT current_uses=1 AND used_by_user_id=public.test_uuid(30) FROM public.coach_invitation_codes WHERE code='ONE-USE') AND (SELECT count(*)=1 FROM public.coach_profiles WHERE user_id IN (public.test_uuid(30),public.test_uuid(31))) AND (SELECT role='PARENT' FROM public.profiles WHERE id=public.test_uuid(31)),'one-use invitation admits exactly one concurrent user');"

    $jobs += Start-TestConnection -Name 'invitation-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_try_redeem(32,'SAME-USER')='OK','first promotion succeeds'); SELECT pg_sleep(3); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'invitation-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.redeem_coach_invitation(public.test_uuid(32),'SAME-USER','Repeated') ->> 'alreadyCoach'='true','same user concurrent retry is idempotent');"
    Complete-TestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT current_uses=1 FROM public.coach_invitation_codes WHERE code='SAME-USER') AND (SELECT count(*)=1 FROM public.coach_profiles WHERE user_id=public.test_uuid(32)) AND (SELECT name='Coach Test' FROM public.profiles WHERE id=public.test_uuid(32)),'same identity gets one profile, one use and original details');"

    Write-Output 'All isolated coach invitation SQL and concurrency tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
}
