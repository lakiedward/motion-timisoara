$ErrorActionPreference = 'Stop'
$containerName = 'motion-parent-announcements-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$database = 'parent_announcement_test'
$jobs = @()

function Invoke-AnnouncementDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

function Invoke-AnnouncementSql {
    param([string] $Sql)
    Invoke-AnnouncementDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
}

function Start-AnnouncementConnection {
    param([string] $Name, [string] $Sql)
    Start-Job -ArgumentList $containerName, $database, $Name, $Sql -ScriptBlock {
        param($Container, $DatabaseName, $ConnectionName, $Statement)
        & docker exec --env "PGAPPNAME=$ConnectionName" $Container psql -X -U supabase_admin -d $DatabaseName -v ON_ERROR_STOP=1 -c $Statement
        if ($LASTEXITCODE -ne 0) { throw "Concurrent SQL connection failed: $ConnectionName" }
    }
}

try {
    Invoke-AnnouncementDocker @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', "POSTGRES_DB=$database", $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d $database *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    foreach ($file in @('00019_announcement_views.sql', '00021_club_announcement_audience_ownership.sql', '00055_camp_announcement_audience.sql', '00056_parent_announcement_feed.sql')) {
        Invoke-AnnouncementDocker @('cp', (Join-Path $PSScriptRoot "../migrations/$file"), "${containerName}:/tmp/$file")
    }
    foreach ($file in @('parent-announcement-feed-bootstrap.sql', 'parent-announcement-feed.sql')) {
        Invoke-AnnouncementDocker @('cp', (Join-Path $PSScriptRoot $file), "${containerName}:/tmp/$file")
        Invoke-AnnouncementDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-f', "/tmp/$file")
    }
    $jobs += Start-AnnouncementConnection -Name 'announcement-newer-visit' -Sql "BEGIN; SET LOCAL ROLE authenticated; SELECT public.test_actor(7); SELECT public.mark_parent_announcements_seen(now()-interval '1 minute',public.test_uuid(7)); SELECT pg_sleep(3); COMMIT;"
    $locked = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d $database -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='announcement-newer-visit' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated test connections.' }
        if ($active.Trim() -eq '1') { $locked = $true; break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $locked) { throw 'Newer visit failed to acquire the watermark lock.' }
    $jobs += Start-AnnouncementConnection -Name 'announcement-older-visit' -Sql "SET ROLE authenticated; SELECT public.test_actor(7); SELECT public.mark_parent_announcements_seen(now()-interval '2 minutes',public.test_uuid(7));"
    $jobs | Wait-Job -Timeout 30 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent watermark test did not complete.' }
    }
    Invoke-AnnouncementSql "SELECT public.test_assert((SELECT last_seen_at > now()-interval '90 seconds' FROM public.user_announcement_views WHERE user_id=public.test_uuid(7)), 'older concurrent visit cannot overwrite newer committed watermark'); SELECT count(*) AS passed_assertions FROM public.test_results;"
    Write-Output 'All isolated parent announcement feed and concurrent watermark tests passed.'
} finally {
    foreach ($testJob in $jobs) {
        Stop-Job -Job $testJob -ErrorAction SilentlyContinue
        Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue
    }
    & docker rm --force --volumes $containerName *> $null
}
