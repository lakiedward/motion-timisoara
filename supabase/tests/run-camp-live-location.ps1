$ErrorActionPreference = 'Stop'
$containerName = 'motion-camp-location-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$database = 'camp_location_test'
$baseSqlPath = [System.IO.Path]::GetTempFileName()
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
        $active = & docker exec $containerName psql -X -U supabase_admin -d $database -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='camp-location-first' AND wait_event='PgSleep'"
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
        if ($testJob.State -ne 'Completed') { throw 'Concurrent camp location test did not complete.' }
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
    $files = @{
        '../migrations/00042_transactional_attendance.sql' = 'transactional-attendance-migration.sql'
        '../migrations/00043_coach_live_location.sql' = 'coach-live-location-core-migration.sql'
        '../migrations/00044_coach_live_location_realtime.sql' = 'coach-live-location-realtime-migration.sql'
        '../migrations/00045_camp_live_location_access.sql' = '00045_camp_live_location_access.sql'
        '../migrations/00046_camp_live_location_transaction.sql' = '00046_camp_live_location_transaction.sql'
        '../migrations/00047_camp_live_location_discovery.sql' = '00047_camp_live_location_discovery.sql'
        'coach-live-location-realtime-bootstrap.sql' = 'coach-live-location-realtime-bootstrap.sql'
        'coach-live-location-realtime-install.sql' = 'coach-live-location-migration.sql'
        'camp-live-location-bootstrap.sql' = 'camp-live-location-bootstrap.sql'
        'camp-live-location.sql' = 'camp-live-location.sql'
        'camp-live-location-consent.sql' = 'camp-live-location-consent.sql'
    }
    foreach ($entry in $files.GetEnumerator()) {
        Invoke-TestDocker -DockerArguments @('cp', (Join-Path $PSScriptRoot $entry.Key), "${containerName}:/tmp/$($entry.Value)")
    }
    $baseSql = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'coach-live-location.sql') -Raw
    $assertionStart = $baseSql.IndexOf("SELECT public.test_assert((SELECT count(*)=1 FROM cron.job")
    if ($assertionStart -lt 0) { throw 'Could not find the existing course fixture boundary.' }
    $baseSql = $baseSql.Insert($assertionStart, "\i /tmp/camp-live-location-bootstrap.sql`n")
    [System.IO.File]::WriteAllText($baseSqlPath, $baseSql)
    Invoke-TestDocker -DockerArguments @('cp', $baseSqlPath, "${containerName}:/tmp/coach-live-location.sql")
    foreach ($testFile in @('coach-live-location.sql', 'camp-live-location.sql')) {
        Invoke-TestDocker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-f', "/tmp/$testFile")
    }
    Invoke-TestSql -Sql "INSERT INTO public.enrollments(id,kind,entity_id,child_id,status) VALUES(public.test_uuid(2299),'CAMP',public.test_uuid(302),public.test_uuid(204),'ACTIVE'); SET ROLE service_role; SELECT public.test_assert(public.test_camp(1,'start',302,jsonb_build_object('requestId',public.test_uuid(8999),'consent',true))->>'success'='true','concurrent camp fixture starts explicitly'); SELECT public.test_camp(1,'update',302,public.test_camp_session(302)||public.test_point()); RESET ROLE; CREATE TABLE public.test_camp_concurrent_session AS SELECT id FROM public.coach_live_location_sessions WHERE camp_id=public.test_uuid(302) AND coach_id=public.test_uuid(1); GRANT SELECT ON public.test_camp_concurrent_session TO service_role;"
    $jobs += Start-TestConnection -Name 'camp-location-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_camp(1,'stop',302,public.test_camp_session(302))->>'success'='true','concurrent camp stop succeeds'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'camp-location-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_camp(1,'update',302,(SELECT jsonb_build_object('sessionId',id) FROM public.test_camp_concurrent_session)||public.test_point())->>'code'='SESSION_NOT_FOUND','camp update waiting on stop cannot restart capture');"
    Wait-ForTestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions WHERE camp_id=public.test_uuid(302)) AND NOT EXISTS(SELECT FROM public.coach_live_locations WHERE session_id IN(SELECT id FROM public.test_camp_concurrent_session)),'concurrent camp stop leaves no session or point');"
    $jobs += Start-TestConnection -Name 'camp-location-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_camp(1,'arrive',302,jsonb_build_object('enrollmentId',public.test_uuid(2299)))->>'success'='true','concurrent camp arrival succeeds'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'camp-location-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_camp(6,'depart',302,jsonb_build_object('enrollmentId',public.test_uuid(2299)))->>'success'='true','camp departure waiting on arrival succeeds');"
    Wait-ForTestConnections
    Invoke-TestSql -Sql "SET ROLE service_role; SELECT public.test_camp(1,'arrive',302,jsonb_build_object('enrollmentId',public.test_uuid(2299))); SELECT public.test_assert((SELECT departed_at IS NOT NULL AND departed_by=public.test_uuid(6) AND arrived_by=public.test_uuid(1) FROM public.camp_participation WHERE enrollment_id=public.test_uuid(2299)),'concurrent departure and subsequent arrival replay preserve departure'); SELECT count(*) AS passed_assertions FROM public.test_results;"
    Invoke-TestSql -Sql "INSERT INTO public.enrollments(id,kind,entity_id,child_id,status) VALUES(public.test_uuid(2399),'CAMP',public.test_uuid(302),public.test_uuid(205),'ACTIVE'); SET ROLE service_role; SELECT public.test_camp(1,'start',302,jsonb_build_object('requestId',public.test_uuid(8998),'consent',true)); SELECT public.test_camp(1,'arrive',302,jsonb_build_object('enrollmentId',public.test_uuid(2399)));"
    $jobs += Start-TestConnection -Name 'camp-location-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_camp(11,'consent',302,public.test_camp_session(302)||jsonb_build_object('consent',true,'expectedVersion',0))->>'success'='true','concurrent parent consent obtains session lock'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'camp-location-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_camp(6,'depart',302,jsonb_build_object('enrollmentId',public.test_uuid(2399)))->>'success'='true','departure waiting on consent grant completes');"
    Wait-ForTestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT NOT granted AND version=2 FROM public.parent_live_location_consents WHERE parent_id=public.test_uuid(11) AND session_id=(public.test_camp_session(302)->>'sessionId')::UUID),'departure revokes a concurrently completed consent grant'); INSERT INTO public.enrollments(id,kind,entity_id,child_id,status) VALUES(public.test_uuid(2398),'CAMP',public.test_uuid(302),public.test_uuid(205),'ACTIVE'); SET ROLE service_role; SELECT public.test_camp(1,'arrive',302,jsonb_build_object('enrollmentId',public.test_uuid(2398)));"
    $jobs += Start-TestConnection -Name 'camp-location-first' -Sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.test_assert(public.test_camp(6,'depart',302,jsonb_build_object('enrollmentId',public.test_uuid(2398)))->>'success'='true','departure first obtains consent serialization lock'); SELECT pg_sleep(5); COMMIT;"
    Wait-ForLockedConnection
    $jobs += Start-TestConnection -Name 'camp-location-second' -Sql "SET ROLE service_role; SELECT public.test_assert(public.test_camp(11,'consent',302,public.test_camp_session(302)||jsonb_build_object('consent',true,'expectedVersion',2))->>'code'='NOT_ELIGIBLE','consent grant waiting on departure cannot restore access');"
    Wait-ForTestConnections
    Invoke-TestSql -Sql "SELECT public.test_assert((SELECT NOT granted AND version=2 FROM public.parent_live_location_consents WHERE parent_id=public.test_uuid(11) AND session_id=(public.test_camp_session(302)->>'sessionId')::UUID),'delayed consent leaves departure revocation intact'); SELECT count(*) AS passed_assertions FROM public.test_results;"
    Write-Output 'All isolated SQL and concurrent camp live location tests passed.'
} finally {
    foreach ($testJob in $jobs) { Stop-Job -Job $testJob -ErrorAction SilentlyContinue; Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue }
    & docker rm --force --volumes $containerName *> $null
    Remove-Item -LiteralPath $baseSqlPath -ErrorAction SilentlyContinue
}
