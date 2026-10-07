param(
    [Parameter(Mandatory)][string]$SourcePath,
    [string]$OutputPath = "$PSScriptRoot/../src/lib/geography/romanian-localities.json"
)

$ErrorActionPreference = 'Stop'
$sourceBytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $SourcePath))
if ($sourceBytes[0] -eq 80 -and $sourceBytes[1] -eq 75) {
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $SourcePath))
    function Read-SourceXml([string]$EntryName) {
        $reader = [IO.StreamReader]::new($archive.GetEntry($EntryName).Open())
        try { [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    try {
        $stringsXml = Read-SourceXml 'xl/sharedStrings.xml'
        $strings = @($stringsXml.sst.si | ForEach-Object { $_.InnerText })
        $sheet = Read-SourceXml 'xl/worksheets/sheet1.xml'
        $rows = @($sheet.worksheet.sheetData.row | Select-Object -Skip 1 | ForEach-Object {
            $values = @($_.c | ForEach-Object {
                if ($_.t -eq 's') { $strings[[int]$_.v] } else { $_.v }
            })
            [pscustomobject]@{ DENLOC=$values[1]; JUD=$values[3]; NIV=$values[6] }
        })
    } finally { $archive.Dispose() }
} else {
    $rows = @(Import-Csv -LiteralPath $SourcePath)
}

$culture = [Globalization.CultureInfo]::GetCultureInfo('ro-RO')
function Format-PlaceName([string]$Name) {
    $culture.TextInfo.ToTitleCase($Name.ToLower($culture)).Replace('ş','ș').Replace('ţ','ț').Replace('Ş','Ș').Replace('Ţ','Ț')
}
$countyRows = @($rows | Where-Object { $_.NIV -eq '1' })
if ($countyRows.Count -ne 42) { throw 'Expected 42 SIRUTA county-level units' }
$catalogue = [ordered]@{}
foreach ($countyRow in ($countyRows | Sort-Object DENLOC)) {
    $name = Format-PlaceName ($countyRow.DENLOC -replace '^JUDE[ŢȚ]UL ', '' -replace '^MUNICIPIUL ', '')
    $localities = @($rows | Where-Object { $_.JUD -eq $countyRow.JUD -and $_.NIV -eq '3' } |
        ForEach-Object { Format-PlaceName $_.DENLOC } | Sort-Object -Unique)
    if ($name -eq 'București') { $localities = @('București') }
    if ($localities.Count -eq 0) { throw "No localities for $name" }
    $catalogue[$name] = $localities
}
$lines = @('{')
$countyNames = @($catalogue.Keys)
for ($i=0; $i -lt $countyNames.Count; $i++) {
    $name = $countyNames[$i]
    $key = ConvertTo-Json -InputObject $name -Compress
    $values = ConvertTo-Json -InputObject @($catalogue[$name]) -Compress
    $suffix = if ($i -lt $countyNames.Count - 1) { ',' } else { '' }
    $lines += "  ${key}: ${values}${suffix}"
}
$lines += '}'
$targetDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), ($lines -join "`n") + "`n")
[pscustomobject]@{
    counties = $countyNames.Count
    localities = ($catalogue.Values | ForEach-Object Count | Measure-Object -Sum).Sum
    source_sha256 = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    output = [IO.Path]::GetFullPath($OutputPath)
} | ConvertTo-Json
