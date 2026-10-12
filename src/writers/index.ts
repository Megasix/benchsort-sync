import type { Dialect } from "../config.js";
import { mysqlWriter } from "./mysql.js";
import { postgresWriter } from "./postgres.js";
import { sqlServerWriter } from "./sqlserver.js";
import type { Writer } from "./types.js";

export type { Writer } from "./types.js";

export function writerFor(dialect: Dialect, url: string): Writer {
  switch (dialect) {
    case "postgres":
      return postgresWriter(url);
    case "mysql":
      return mysqlWriter(url);
    case "sqlserver":
      return sqlServerWriter(url);
  }
}
