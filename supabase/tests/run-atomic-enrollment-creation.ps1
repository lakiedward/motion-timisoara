$ErrorActionPreference = 'Stop'
$migrationRoot = Join-Path $PSScriptRoot '../migrations'
$containerName = 'motion-enrollment-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$jobs = @()

function Invoke-TestDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-TestSql {
    param([string] $Sql)
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'enrollment_test', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-TestConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $Name, $Sql -ScriptBlock {
        param($Container, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d enrollment_test -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

function Wait-ForLockedConnection {
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d enrollment_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='enrollment-first' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated connections.' }
        if ($active.Trim() -eq '1') { return }
        Start-Sleep -Milliseconds 100
    }
    throw 'The first transaction did not acquire its lock.'
}

function Complete-TestConnections {
    $jobs | Wait-Job -Timeout 45 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent enrollment test did not complete.' }
    }
}

try {
    Invoke-TestDocker -DockerArguments @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=enrollment_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d enrollment_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-TestDocker -DockerArguments @('cp', $migrationRoot, "${containerName}:/tmp/migrations")
    Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot 'atomic-enrollment-creation.sql'), "${containerName}:/tmp/atomic-enrollment-creation.sql")
    Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'enrollment_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/atomic-enrollment-creation.sql')

    $jobs += Start-TestConnection -Name 'enrollment-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_try_save(ARRAY[230],'CARD',102)='OK','first concurrent batch creates'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'enrollment-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_try_save(ARRAY[230],'CARD',102)='OK','second concurrent batch reuses');"
    Complete-TestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT count(*)=1 FROM public.enrollments WHERE entity_id=public.test_uuid(102)) AND (SELECT count(*)=1 FROM public.payments p JOIN public.enrollments e ON e.id=p.enrollment_id WHERE e.entity_id=public.test_uuid(102)),'concurrent batches create one enrollment and payment');"

    $jobs += Start-TestConnection -Name 'enrollment-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_try_save(ARRAY[231],'CARD',101)='OK','first buyer takes final place'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'enrollment-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_try_save(ARRAY[232],'CARD',101)='23514','second buyer cannot oversell capacity');"
    Complete-TestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT count(*)=1 FROM public.enrollments WHERE entity_id=public.test_uuid(101)),'capacity remains one after concurrent requests');"

    $jobs += Start-TestConnection -Name 'enrollment-first' -Sql "BEGIN; SET LOCAL ROLE service_role; UPDATE public.payments SET gateway_txn_id='pi_concurrent' WHERE enrollment_id=(SELECT id FROM public.enrollments WHERE entity_id=public.test_uuid(102)); SELECT public.apply_enrollment_payment_result((SELECT p.id FROM public.payments p JOIN public.enrollments e ON e.id=p.enrollment_id WHERE e.entity_id=public.test_uuid(102)),'SUCCEEDED',15370,'RON','CARD','pi_concurrent'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'enrollment-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_try_save(ARRAY[230],'CARD',102)='OK','retry racing completion returns original paid enrollment');"
    Complete-TestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT count(*)=1 AND min(purchased_sessions)=3 AND min(remaining_sessions)=3 FROM public.enrollments WHERE entity_id=public.test_uuid(102)),'concurrent fulfillment and retry credit once');"
    Write-Output 'All isolated SQL and concurrent enrollment tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
}
