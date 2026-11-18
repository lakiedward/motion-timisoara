$ErrorActionPreference = 'Stop'
$containerName = 'motion-activity-roster-' + [Guid]::NewGuid().ToString('N')
$image = 'supabase/postgres:17.6.1.063@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'

function Invoke-RosterDocker {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

try {
    Invoke-RosterDocker @('run', '--detach', '--name', $containerName, '--network', 'none', '--env', 'POSTGRES_PASSWORD=local-test-only', '--env', 'POSTGRES_DB=activity_roster_test', $image, 'postgres', '-D', '/var/lib/postgresql/data')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d activity_roster_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated PostgreSQL did not become ready within 30 seconds.' }
    Invoke-RosterDocker @('cp', (Join-Path $PSScriptRoot '../migrations/00145_club_activity_attendance_roster.sql'), "${containerName}:/tmp/club-activity-attendance-roster-migration.sql")
    Invoke-RosterDocker @('cp', (Join-Path $PSScriptRoot 'club-activity-attendance-roster.sql'), "${containerName}:/tmp/test.sql")
    Invoke-RosterDocker @('exec', $containerName, 'psql', '-X', '-U', 'supabase_admin', '-d', 'activity_roster_test', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/test.sql')
} finally {
    & docker rm --force --volumes $containerName *> $null
}
