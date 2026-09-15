$ErrorActionPreference = 'Stop'
$containerName = 'motion-push-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
$database = 'push_test'
$jobs = @()

function Invoke-PushDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

try {
    Invoke-PushDocker @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', "POSTGRES_DB=$database", $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d $database *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-PushDocker @('cp', (Join-Path $PSScriptRoot '../migrations/00057_android_parent_push.sql'), "${containerName}:/tmp/00057_android_parent_push.sql")
    foreach ($file in @('push-bootstrap.sql', 'push-delivery.sql')) {
        Invoke-PushDocker @('cp', (Join-Path $PSScriptRoot $file), "${containerName}:/tmp/$file")
        Invoke-PushDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-f', "/tmp/$file")
    }
    $jobs += Start-Job -ArgumentList $containerName, $database -ScriptBlock {
        param($Container, $DatabaseName)
        & docker exec --env 'PGAPPNAME=push-claim-one' $Container psql -X -U supabase_admin -d $DatabaseName -v ON_ERROR_STOP=1 -c "BEGIN; INSERT INTO public.test_claims VALUES('one',public.claim_push_deliveries(1)); SELECT pg_sleep(3); COMMIT;"
        if ($LASTEXITCODE -ne 0) { throw 'First concurrent claim failed.' }
    }
    $locked = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $active = & docker exec $containerName psql -X -U supabase_admin -d $database -At -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='push-claim-one' AND wait_event='PgSleep'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated claim connections.' }
        if ($active.Trim() -eq '1') { $locked = $true; break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $locked) { throw 'First claim failed to acquire its delivery lock.' }
    Invoke-PushDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-c', "SET statement_timeout='1500ms'; INSERT INTO public.test_claims VALUES('two',public.claim_push_deliveries(1));")
    $jobs | Wait-Job -Timeout 15 | Out-Null
    foreach ($testJob in $jobs) {
        Receive-Job -Job $testJob -ErrorAction Stop
        if ($testJob.State -ne 'Completed') { throw 'Concurrent claim did not complete.' }
    }
    Invoke-PushDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-c', "SELECT public.test_assert((SELECT count(*)=2 AND count(DISTINCT claim->0->>'deliveryId')=2 AND bool_and(jsonb_array_length(claim)=1) FROM public.test_claims),'concurrent claim skips locked row without waiting or double delivery'); SELECT count(*) AS passed_assertions FROM public.test_results;")
    Write-Output 'All isolated push delivery tests passed.'
} finally {
    foreach ($testJob in $jobs) {
        Stop-Job -Job $testJob -ErrorAction SilentlyContinue
        Remove-Job -Job $testJob -Force -ErrorAction SilentlyContinue
    }
    & docker rm --force --volumes $containerName *> $null
}
