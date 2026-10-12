# BenchSort Sync

Writes [BenchSort](https://app.benchsort.com) exports into a museum's own database, and
copies the renamed photos to a folder or a network share. It runs on a computer or server
at the museum: it calls BenchSort, so no firewall opening is needed.

Each time a session is exported in BenchSort, BenchSort Sync:

1. writes a row per specimen (or per photo) into your tables, adding new ones and
   updating the ones already there by their key;
2. copies the photos under their exported names.

Databases: **PostgreSQL**, **MySQL / MariaDB** and **SQL Server**.

## Install

- **Single executable**: download it for Windows, macOS or Linux from the
  [releases](../../releases). Nothing else to install.
- **Docker**:
  `docker run -v $PWD:/data ghcr.io/megasix/benchsort-sync run`, with
  `benchsort-sync.json` in the current folder.

## Set up

1. In BenchSort, **Settings → API and webhooks**: make an API key.
2. Run `benchsort-sync init`. It writes `benchsort-sync.json` to fill in.
3. Run `benchsort-sync check`. It checks the key, the database and its tables.
4. Run `benchsort-sync run`. It takes in what is new, then again every 15 minutes. Install
   it as a service (Windows Task Scheduler, systemd, launchd) to keep it going.

```json
{
  "benchsort": { "url": "https://app.benchsort.com", "key": "bsk_…" },
  "photos": { "folder": "D:\\Collections\\Photos", "perSession": true },
  "database": {
    "dialect": "sqlserver",
    "url": "Server=localhost;Database=Collection;User Id=sync;Password=…;Encrypt=true",
    "tables": [
      {
        "table": "dbo.specimens",
        "rows": "specimen",
        "key": "catalog_number",
        "columns": {
          "catalog_number": "{catalogNumber}",
          "scientific_name": "{scientificName}",
          "collector": "{recordedBy}",
          "collected_on": "{eventDate}",
          "photos": "{files}"
        }
      }
    ]
  }
}
```

The key and the database address can come from `BENCHSORT_KEY` and
`BENCHSORT_SYNC_DATABASE_URL` instead.

## Columns

Each column is a template, with the placeholders of BenchSort's export profiles:

- **Per specimen**: `{catalogNumber}`, `{otherCatalogNumbers}`, `{occurrenceID}`,
  `{institutionCode}`, `{collectionCode}`, `{files}`, `{session}`, `{site}`,
  `{exportDate}`, and every specimen data term (`{scientificName}`, `{recordedBy}`,
  `{eventDate}`, `{locality}`, `{decimalLatitude}`…).
- **With `"rows": "photo"`**, also `{file}`, `{originalName}`, `{photoNumber}` and
  `{capturedAt}`.

Text can surround placeholders: `"UAM:Mamm:{catalogNumber}"`. An empty value is written as
NULL. A row whose key is empty is left out.

The table must exist, with a unique index or primary key on the key column. BenchSort Sync
never creates, alters or deletes tables or rows.

## What it remembers

`benchsort-sync.state.json` records each session's last export taken in. Delete a
session's entry to take it in again. Photos already in the folder are not downloaded
again.

BenchSort keeps a session's photos 14 days after its last activity by default. A session
exported then left longer is written without its photos.

## License

MIT.
