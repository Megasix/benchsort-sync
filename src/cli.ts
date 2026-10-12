#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { benchSortApi } from "./api.js";
import { ConfigError, readConfig, SAMPLE_CONFIG } from "./config.js";
import { readState, writeState } from "./state.js";
import { syncOnce } from "./sync.js";
import { writerFor } from "./writers/index.js";

const HELP = `benchsort-sync: writes BenchSort exports into your database and copies the photos.

  benchsort-sync init    write a sample benchsort-sync.json to fill in
  benchsort-sync check   check the key, the database and its tables
  benchsort-sync once    take in what is new, once
  benchsort-sync run     take in what is new, then again every few minutes

  --config <file>        the configuration (default: benchsort-sync.json)

Secrets may come from BENCHSORT_KEY and BENCHSORT_SYNC_DATABASE_URL.`;

function log(line: string) {
  console.log(`${new Date().toISOString()} ${line}`);
}

async function main(argv: string[]): Promise<number> {
  const command = argv[0] ?? "help";
  const at = argv.indexOf("--config");
  const configPath = at >= 0 ? (argv[at + 1] ?? "") : "benchsort-sync.json";
  if (command === "help" || command === "--help") {
    console.log(HELP);
    return 0;
  }
  if (command === "init") {
    await writeFile(configPath, JSON.stringify(SAMPLE_CONFIG, null, 2) + "\n", { flag: "wx" });
    console.log(`Wrote ${configPath}: fill in your key, folder and database, then run "check".`);
    return 0;
  }
  const config = await readConfig(configPath);
  const api = benchSortApi(config.benchsort.url, config.benchsort.key);
  const writer = config.database ? writerFor(config.database.dialect, config.database.url) : null;
  try {
    if (command === "check") {
      const sessions = await api.exportedSessions();
      log(`BenchSort: key works, ${String(sessions.length)} exported sessions.`);
      for (const mapping of config.database?.tables ?? []) {
        await writer?.check(mapping.table);
        log(`Database: table ${mapping.table} is reachable.`);
      }
      return 0;
    }
    const runOnce = async () => {
      const state = await readState(config.stateFile);
      const results = await syncOnce(config, api, writer, state, log);
      await writeState(config.stateFile, state);
      if (results.length === 0) log("Nothing new.");
    };
    if (command === "once") {
      await runOnce();
      return 0;
    }
    if (command === "run") {
      log(`Running every ${String(config.intervalMinutes)} minutes.`);
      for (;;) {
        try {
          await runOnce();
        } catch (error) {
          // BenchSort or the database unreachable: try again next time.
          log(`Run failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, config.intervalMinutes * 60_000));
      }
    }
    console.error(HELP);
    return 2;
  } finally {
    await writer?.close();
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof ConfigError ? error.message : error);
    process.exit(1);
  },
);
