# Romanian localities

`romanian-localities.json` is generated from **INS, SIRUTA S1 2025**, licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Source: [official dataset](https://data.gov.ro/dataset/siruta-2025) and
[official resource](https://data.gov.ro/dataset/fcba1a54-cffd-422c-b3ac-920f63564085/resource/0ab29d86-302c-4cfa-b9b9-fd5c7ff90710/download/siruta_s1_2025.csv).

The resource served on 2026-10-07 is an Excel workbook despite its CSV filename.
Source SHA-256: `16fd439494255236a262acd4e507aff34867827ab7a5f4176792350c4c90a418`.

From the application root, regenerate using:

```powershell
pwsh -NoProfile -File scripts/generate-romanian-localities.ps1 -SourcePath <downloaded-resource>
```

The generator keeps county-level units and level-three locality names, converts
uppercase names to display case, normalizes Romanian comma diacritics, and deduplicates
same-name localities within a county. Bucharest is selectable as both county unit
and locality. The output has 42 county units and 13,262 unique locality choices.
County and locality are display strings; precise coordinates always come from the map.

Address lookup remains on [Photon](https://github.com/komoot/photon/blob/master/docs/api-v1.md)
with OpenStreetMap data. `countrycode=RO` replaces the former Timișoara-only bounding
box; selected locality and county are included in the search text. County properties
are distinct from locality properties. Provider spelling is matched without diacritics;
unmatched existing values are preserved as choices. Ambiguous locality names do not
infer a county.
