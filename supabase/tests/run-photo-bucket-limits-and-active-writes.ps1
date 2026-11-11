$ErrorActionPreference = 'Stop'
$containerName = 'motion-photo-bucket-limits-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'

function Invoke-PhotoBucketLimitsDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

try {
    Invoke-PhotoBucketLimitsDocker @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=photo_bucket_limits_test', $image, 'postgres', '-D', '/var/lib/postgresql/data', '-c', 'shared_preload_libraries=supautils', '-c', 'supautils.superuser=supabase_admin', '-c', 'supautils.privileged_role=postgres', '-c', 'supautils.privileged_role_allowed_configs=pgrst.*', '-c', 'supautils.reserved_roles=supabase_admin, authenticator*, authenticated*, anon*, service_role*')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d photo_bucket_limits_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-PhotoBucketLimitsDocker @('cp', (Join-Path $PSScriptRoot '../migrations'), "${containerName}:/tmp/migrations")
    Invoke-PhotoBucketLimitsDocker @('cp', (Join-Path $PSScriptRoot 'photo-bucket-limits-and-active-writes.sql'), "${containerName}:/tmp/test.sql")
    Invoke-PhotoBucketLimitsDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'photo_bucket_limits_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/test.sql')
} finally {
    & docker rm --force --volumes $containerName *> $null
}
