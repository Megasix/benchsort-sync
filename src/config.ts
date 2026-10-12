import { readFile } from "node:fs/promises";

/**
 * benchsort-sync.json: where BenchSort is, where the photos go, and how each specimen
 * becomes a row of the museum's table. Column values are templates with BenchSort's
 * export placeholders, the same as export profiles: "{catalogNumber}", "{scientificName}",
 * "UAM:Mamm:{catalogNumber}".
 */
export type Dialect = "postgres" | "mysql" | "sqlserver";

export interface TableMapping {
  table: string;
  /** "specimen": a row per specimen; "photo": a row per exported photo. */
  rows: "specimen" | "photo";
  /** The column that identifies a row: existing rows are updated, others added. */
  key: string;
  columns: Record<string, string>;
}

export interface Config {
  benchsort: { url: string; key: string };
  /** Where the renamed photos are copied; omit to copy none. */
  photos?: { folder: string; perSession: boolean };
  database?: { dialect: Dialect; url: string; tables: TableMapping[] };
  /** Minutes between two runs of `benchsort-sync run`. */
  intervalMinutes: number;
  /** Where the agent remembers what it has written. */
  stateFile: string;
}

export class ConfigError extends Error {}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}(\.[A-Za-z_][A-Za-z0-9_]{0,62})?$/;

function fail(message: string): never {
  throw new ConfigError(message);
}

function object(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${where} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${where} must be a text`);
  return value.trim();
}

function identifier(value: unknown, where: string): string {
  const name = string(value, where);
  // Names go into SQL: letters, digits and _ only, optionally schema.table.
  if (!IDENTIFIER.test(name)) fail(`${where} "${name}" must be letters, digits and _`);
  return name;
}

/** Checks a config read from JSON; environment variables fill the secrets. */
export function parseConfig(raw: unknown, env: Record<string, string | undefined> = {}): Config {
  const root = object(raw, "The configuration");
  const benchsort = object(root.benchsort ?? {}, "benchsort");
  const key = env.BENCHSORT_KEY ?? (benchsort.key as string | undefined);
  if (!key?.startsWith("bsk_")) fail("benchsort.key (or BENCHSORT_KEY) must be an API key: bsk_…");
  const config: Config = {
    benchsort: {
      url: (typeof benchsort.url === "string"
        ? benchsort.url
        : "https://app.benchsort.com"
      ).replace(/\/+$/, ""),
      key,
    },
    intervalMinutes:
      typeof root.intervalMinutes === "number" && root.intervalMinutes >= 1
        ? root.intervalMinutes
        : 15,
    stateFile: typeof root.stateFile === "string" ? root.stateFile : "benchsort-sync.state.json",
  };
  if (
    !config.benchsort.url.startsWith("https://") &&
    !config.benchsort.url.startsWith("http://localhost")
  ) {
    fail("benchsort.url must be an https address");
  }
  if (root.photos !== undefined) {
    const photos = object(root.photos, "photos");
    config.photos = {
      folder: string(photos.folder, "photos.folder"),
      perSession: photos.perSession !== false,
    };
  }
  if (root.database !== undefined) {
    const database = object(root.database, "database");
    const dialect = database.dialect;
    if (dialect !== "postgres" && dialect !== "mysql" && dialect !== "sqlserver") {
      fail('database.dialect must be "postgres", "mysql" or "sqlserver"');
    }
    const url = env.BENCHSORT_SYNC_DATABASE_URL ?? (database.url as string | undefined);
    const tables = Array.isArray(database.tables)
      ? database.tables
      : fail("database.tables must be a list");
    config.database = {
      dialect,
      url: string(url, "database.url (or BENCHSORT_SYNC_DATABASE_URL)"),
      tables: tables.map((raw, i) => {
        const where = `database.tables[${String(i)}]`;
        const table = object(raw, where);
        const columns = object(table.columns, `${where}.columns`);
        const mapping: TableMapping = {
          table: identifier(table.table, `${where}.table`),
          rows: table.rows === "photo" ? "photo" : "specimen",
          key: identifier(table.key, `${where}.key`),
          columns: Object.fromEntries(
            Object.entries(columns).map(([column, template]) => [
              identifier(column, `${where}.columns`),
              typeof template === "string"
                ? template
                : fail(`${where}.columns.${column} must be a text`),
            ]),
          ),
        };
        if (!(mapping.key in mapping.columns)) {
          fail(`${where}.key "${mapping.key}" must be one of its columns`);
        }
        return mapping;
      }),
    };
  }
  if (!config.photos && !config.database) fail("Give photos, a database, or both");
  return config;
}

export async function readConfig(path: string, env = process.env): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    fail(`No configuration at ${path}: run "benchsort-sync init" to make one`);
  }
  try {
    return parseConfig(JSON.parse(text), env);
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${path} is not valid JSON: ${error.message}`);
    throw error;
  }
}

export const SAMPLE_CONFIG = {
  benchsort: { url: "https://app.benchsort.com", key: "bsk_… (or set BENCHSORT_KEY)" },
  photos: { folder: "/path/to/photos", perSession: true },
  database: {
    dialect: "postgres",
    url: "postgres://user:password@localhost:5432/collection (or set BENCHSORT_SYNC_DATABASE_URL)",
    tables: [
      {
        table: "specimens",
        rows: "specimen",
        key: "catalog_number",
        columns: {
          catalog_number: "{catalogNumber}",
          scientific_name: "{scientificName}",
          collector: "{recordedBy}",
          collected_on: "{eventDate}",
          locality: "{locality}",
          latitude: "{decimalLatitude}",
          longitude: "{decimalLongitude}",
          photos: "{files}",
        },
      },
    ],
  },
  intervalMinutes: 15,
  stateFile: "benchsort-sync.state.json",
};
